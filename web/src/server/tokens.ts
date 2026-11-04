import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";

export const newManageToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newReference() {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `K4-${s}`;
}
