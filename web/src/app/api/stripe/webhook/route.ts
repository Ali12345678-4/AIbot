import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/server/payments";
import { confirmCheckout } from "@/server/bookings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event;
  try {
    event = verifyWebhook(await req.text(), sig);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await confirmCheckout(event.data.object.id);
  }
  return NextResponse.json({ received: true });
}
