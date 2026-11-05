import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = new Client({ connectionString: url, ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  await client.query("alter table schema_migrations enable row level security");
  const dir = join(process.cwd(), "netlify", "database", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query<{ name: string }>("select name from schema_migrations");
  const done = new Set(rows.map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`Applying ${file}... `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("done");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  await client.end();
  console.log("Migrations up to date.");
}
main().catch((e) => { console.error(e); process.exit(1); });
