import { describe, expect, it } from "vitest";
import { CONVERSATION_START } from "@/lib/ai/conversation";
import { mapVapiStatus, normalizeTranscript, parseEndOfCallReport } from "./events";
import { openAiStream, openAiToAnthropic } from "./openai-compat";

describe("openAiToAnthropic", () => {
  it("convierte el historial de Vapi y garantiza que empiece con el cliente", () => {
    const result = openAiToAnthropic([
      { role: "system", content: "ignorado" },
      { role: "assistant", content: "¡Hola! ¿En qué te ayudo?" },
      { role: "user", content: "Busco apartamento" },
      { role: "user", content: "en Chapinero" },
    ]);
    expect(result).toEqual([
      { role: "user", content: CONVERSATION_START },
      { role: "assistant", content: "¡Hola! ¿En qué te ayudo?" },
      { role: "user", content: "Busco apartamento\nen Chapinero" },
    ]);
  });

  it("agrega un turno del cliente si el último mensaje es del agente", () => {
    const result = openAiToAnthropic([
      { role: "user", content: "Hola" },
      { role: "assistant", content: [{ type: "text", text: "Hola, ¿qué buscas?" }] },
    ]);
    expect(result.at(-1)?.role).toBe("user");
  });
});

describe("openAiStream", () => {
  it("emite chunks SSE compatibles con OpenAI y termina con [DONE]", async () => {
    const res = openAiStream("claude", async (write) => {
      write("Hola");
      write(", ¿cómo estás?");
    }, "fallback");
    const body = await res.text();
    const events = body
      .split("\n\n")
      .filter(Boolean)
      .map((e) => e.replace(/^data: /, ""));
    expect(events.at(-1)).toBe("[DONE]");
    const chunks = events.slice(0, -1).map((e) => JSON.parse(e));
    expect(chunks[0].choices[0].delta).toEqual({ role: "assistant", content: "Hola" });
    expect(chunks[1].choices[0].delta).toEqual({ content: ", ¿cómo estás?" });
    expect(chunks.at(-1).choices[0].finish_reason).toBe("stop");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("emite el texto de respaldo si la generación falla", async () => {
    const res = openAiStream("claude", async () => {
      throw new Error("boom");
    }, "Disculpa, tuve un problema.");
    expect(await res.text()).toContain("Disculpa, tuve un problema.");
  });
});

describe("eventos de Vapi", () => {
  it("mapea estados", () => {
    expect(mapVapiStatus("in-progress")).toBe("in_progress");
    expect(mapVapiStatus("ended", "customer-ended-call")).toBe("ended");
    expect(mapVapiStatus("ended", "pipeline-error-openai-llm-failed")).toBe("failed");
    expect(mapVapiStatus("desconocido")).toBeUndefined();
  });

  it("normaliza la transcripción", () => {
    expect(normalizeTranscript("AI: Hola\nUser: Buenas", "Sofía")).toBe("Sofía: Hola\nCliente: Buenas");
  });

  it("extrae los datos del informe de fin de llamada", () => {
    const report = parseEndOfCallReport(
      {
        type: "end-of-call-report",
        endedReason: "customer-ended-call",
        startedAt: "2026-10-08T15:00:00.000Z",
        endedAt: "2026-10-08T15:02:30.000Z",
        cost: 0.12,
        artifact: { transcript: "AI: Hola\nUser: Adiós", recordingUrl: "https://example.com/rec.wav" },
      },
      "Sofía",
    );
    expect(report).toMatchObject({
      status: "ended",
      durationSec: 150,
      recordingUrl: "https://example.com/rec.wav",
      transcript: "Sofía: Hola\nCliente: Adiós",
      cost: 0.12,
    });
  });
});
