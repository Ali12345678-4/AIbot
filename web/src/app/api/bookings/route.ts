import { NextResponse, type NextRequest } from "next/server";
import { createBookingSchema } from "@/lib/validation";
import { BookingError, createBooking } from "@/server/bookings";
import { clientIp, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      fieldErrors[k] ??= issue.message;
    }
    return NextResponse.json({ error: "Please check the highlighted fields.", fieldErrors }, { status: 422 });
  }
  const ip = await clientIp();
  if (!(await rateLimit(`book:${ip}`, 8, 60)) || !(await rateLimit(`book:${parsed.data.email}`, 5, 60))) {
    return NextResponse.json({ error: "Too many booking attempts. Please try again later or contact us directly." }, { status: 429 });
  }
  try {
    const result = await createBooking(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) {
      const status = e.code === "slot_unavailable" ? 409 : e.code === "lesson_unavailable" ? 410 : 400;
      return NextResponse.json({ error: e.message, code: e.code, field: e.field }, { status });
    }
    console.error("[api/bookings]", e);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
