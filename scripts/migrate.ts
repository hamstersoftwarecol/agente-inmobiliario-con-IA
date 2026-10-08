import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está configurada");
  const client = postgres(url, { max: 1 });
  console.log("⏳ Aplicando migraciones…");
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("✅ Migraciones aplicadas");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Error al migrar:", err);
  process.exit(1);
});
