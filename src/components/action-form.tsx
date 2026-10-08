"use client";

import { Loader2 } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import type { ActionState } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Formulario conectado a una Server Action con estado de envío y mensajes de error/éxito. */
export function ActionForm({
  action,
  children,
  submitLabel = "Guardar",
  className,
  footer,
  submitVariant = "primary",
  hideSubmit,
}: {
  action: Action;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  footer?: ReactNode;
  submitVariant?: "primary" | "secondary" | "danger";
  hideSubmit?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={cn("space-y-5", className)}>
      {children}
      {state.error ? (
        <Alert tone="error" title={state.error}>
          {state.fieldErrors ? (
            <ul className="list-disc pl-4">
              {Object.entries(state.fieldErrors).map(([field, messages]) => (
                <li key={field}>{messages?.[0]}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {state.message && !state.error ? <Alert tone="success" title={state.message} /> : null}
      {hideSubmit ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={buttonClass(submitVariant)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitLabel}
          </button>
          {footer}
        </div>
      )}
    </form>
  );
}

/** Botón de envío para formularios simples (sin estado), p. ej. acciones de una fila. */
export function SubmitButton({
  children,
  variant = "secondary",
  size = "sm",
  className,
  confirm,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
  className?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}
