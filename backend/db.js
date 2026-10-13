import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import fs from "node:fs";
const postgres = Boolean(process.env.DATABASE_URL);
fs.mkdirSync("var", { recursive: true });
const db = postgres
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : new DatabaseSync(process.env.SQLITE_PATH || "var/alagamanaus.sqlite");
if (!postgres) db.exec("PRAGMA foreign_keys = ON");
export async function query(sql, args = []) {
  if (postgres) return (await db.query(sql, args)).rows;
  const s = db.prepare(sql.replace(/\$\d+/g, "?"));
  return /^\s*(SELECT|WITH)/i.test(sql) ? s.all(...args) : s.run(...args);
}
export async function init() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('citizen','manager','admin')),active INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS occurrences(id TEXT PRIMARY KEY,title TEXT NOT NULL,neighborhood TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('alagamento','residuo')),description TEXT NOT NULL,lat DOUBLE PRECISION NOT NULL,lng DOUBLE PRECISION NOT NULL,date TEXT NOT NULL,moderation TEXT NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')),status TEXT NOT NULL DEFAULT 'em_analise',owner TEXT REFERENCES users(id),contact TEXT,created TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS attachments(occurrence_id TEXT PRIMARY KEY REFERENCES occurrences(id) ON DELETE CASCADE,mime TEXT NOT NULL,bytes INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT,action TEXT NOT NULL,target TEXT NOT NULL,detail TEXT NOT NULL,created TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS occurrence_filters ON occurrences(moderation,date,type,neighborhood)`,
  ])
    await query(sql);
  if (postgres) {
    await query("CREATE EXTENSION IF NOT EXISTS postgis");
    await query(
      `ALTER TABLE occurrences ADD COLUMN IF NOT EXISTS geom geometry(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng,lat),4326)) STORED`,
    );
    await query(
      "CREATE INDEX IF NOT EXISTS occurrence_geom ON occurrences USING GIST(geom)",
    );
  }
}
export async function close() {
  if (postgres) await db.end();
  else db.close();
}
