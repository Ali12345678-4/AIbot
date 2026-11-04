"use server";
import { redirect } from "next/navigation";
import { login } from "@/server/auth";
import { clientIp, rateLimit } from "@/server/rate-limit";

export async function signIn(_prev: { error?: string; email?: string } | undefined, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 10, 15)) || !(await rateLimit(`login:${email.toLowerCase()}`, 10, 15))) {
    return { error: "Too many attempts. Please wait 15 minutes and try again.", email };
  }
  if (!(await login(email, password))) return { error: "That email and password don’t match.", email };
  redirect("/admin");
}
