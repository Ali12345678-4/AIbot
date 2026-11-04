import bcrypt from "bcryptjs";
import { Client } from "pg";
import { createInterface } from "node:readline/promises";

// Usage: npm run create-admin -- you@example.com "Your Name"
// Prompts for a password (or reads ADMIN_PASSWORD from the environment).
async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email) throw new Error('Usage: npm run create-admin -- <email> ["Name"]');
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Password (min 10 characters): ");
    rl.close();
  }
  if (!password || password.length < 10) throw new Error("Password must be at least 10 characters.");
  const url = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: url, ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  const hash = await bcrypt.hash(password, 12);
  await client.query(
    `insert into admin_users (email, name, password_hash) values (lower($1), $2, $3)
     on conflict (email) do update set password_hash = excluded.password_hash, name = coalesce(excluded.name, admin_users.name)`,
    [email, name ?? null, hash],
  );
  await client.end();
  console.log(`Admin account ready for ${email.toLowerCase()}.`);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
