import "server-only";
import Stripe from "stripe";

/**
 * Payment provider layer. Online payment is only active when STRIPE_SECRET_KEY is set
 * AND the admin chooses "deposit" or "full" in Settings. Otherwise bookings fall back
 * to pay-at-lesson, so the site never shows a payment step that cannot work.
 *
 * When instructor approval is on, cards are authorised at booking and only captured
 * when the instructor accepts (Stripe manual capture). Declining releases the hold.
 */
let stripe: Stripe | null = null;

export function paymentsAvailable() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function client() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export async function createCheckout(opts: {
  bookingId: string;
  reference: string;
  description: string;
  amountPence: number;
  currency: string;
  email: string;
  manualCapture: boolean;
  successUrl: string;
  cancelUrl: string;
}) {
  const session = await client().checkout.sessions.create({
    mode: "payment",
    customer_email: opts.email,
    client_reference_id: opts.bookingId,
    metadata: { booking_id: opts.bookingId, reference: opts.reference },
    payment_intent_data: {
      capture_method: opts.manualCapture ? "manual" : "automatic",
      metadata: { booking_id: opts.bookingId, reference: opts.reference },
      description: opts.description,
    },
    line_items: [{ quantity: 1, price_data: { currency: opts.currency.toLowerCase(), unit_amount: opts.amountPence, product_data: { name: opts.description } } }],
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  return { id: session.id, url: session.url! };
}

/** Returns the PaymentIntent id + whether funds are authorised or captured. */
export async function checkoutStatus(sessionId: string) {
  const s = await client().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  const pi = s.payment_intent as Stripe.PaymentIntent | null;
  if (!pi) return { bookingId: s.metadata?.booking_id, status: "unpaid" as const, paymentIntentId: null };
  const status = pi.status === "succeeded" ? ("paid" as const) : pi.status === "requires_capture" ? ("authorised" as const) : ("unpaid" as const);
  return { bookingId: s.metadata?.booking_id, status, paymentIntentId: pi.id };
}

export async function capture(paymentIntentId: string) {
  await client().paymentIntents.capture(paymentIntentId);
}
export async function release(paymentIntentId: string) {
  await client().paymentIntents.cancel(paymentIntentId);
}
export async function refund(paymentIntentId: string) {
  await client().refunds.create({ payment_intent: paymentIntentId });
}

export function verifyWebhook(body: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return client().webhooks.constructEvent(body, signature, secret);
}
