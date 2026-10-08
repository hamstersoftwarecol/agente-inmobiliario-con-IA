import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Database; __sql?: postgres.Sql };

function createDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL no está configurada. Revisa tu archivo .env");
  }
  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: process.env.DATABASE_DISABLE_PREPARE === "true" ? false : true,
  });
  globalForDb.__sql = client;
  return drizzle(client, { schema });
}

function getDb(): Database {
  // Reutiliza la conexión entre recargas en desarrollo y entre invocaciones.
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}

/**
 * Cliente Drizzle perezoso: no abre conexiones hasta la primera consulta,
 * así el build de Next.js funciona sin base de datos disponible.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export async function closeDb() {
  await globalForDb.__sql?.end({ timeout: 5 });
  globalForDb.__db = undefined;
  globalForDb.__sql = undefined;
}

export { schema };
