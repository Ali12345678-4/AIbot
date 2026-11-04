import "server-only";
import { query } from "./db";

/**
 * Provider-agnostic email sending.
 *
 * EMAIL_PROVIDER=log    (default) store every message in email_log only; visible in Admin > Emails.
 * EMAIL_PROVIDER=resend send through Resend (RESEND_API_KEY, EMAIL_FROM).
 *
 * Add another provider by implementing EmailDriver and registering it below.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  bookingId?: string;
}

interface EmailDriver {
  name: string;
  send(msg: EmailMessage): Promise<void>;
}

const logDriver: EmailDriver = { name: "log", async send() {} };

const resendDriver: EmailDriver = {
  name: "resend",
  async send(msg) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM must be set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, reply_to: msg.replyTo }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  },
};

function driver(): EmailDriver {
  switch ((process.env.EMAIL_PROVIDER ?? "log").toLowerCase()) {
    case "resend":
      return resendDriver;
    default:
      return logDriver;
  }
}

export function emailConfigured() {
  return driver().name !== "log";
}

/** Sends and records an email. Never throws: a failed email must not break a booking. */
export async function sendEmail(msg: EmailMessage) {
  const d = driver();
  let status: "sent" | "logged" | "failed" = d.name === "log" ? "logged" : "sent";
  let error: string | null = null;
  try {
    await d.send(msg);
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
    console.error("[email] send failed", error);
  }
  try {
    await query(
      "insert into email_log (booking_id, to_address, subject, body_text, provider, status, error) values ($1,$2,$3,$4,$5,$6,$7)",
      [msg.bookingId ?? null, msg.to, msg.subject, msg.text, d.name, status, error],
    );
  } catch (e) {
    console.error("[email] log failed", e);
  }
}
