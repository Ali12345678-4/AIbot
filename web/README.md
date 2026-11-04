# K444AXN Driving School

Website, online booking system and instructor dashboard.

- **Public site**: homepage, lessons and prices, instructor profile, reviews, FAQ, privacy and terms.
- **Booking** (`/book`): pick a lesson, then a date, a time and your details, review and confirm. No account needed. Students cancel through a private link in their email.
- **Dashboard** (`/admin`): overview, bookings (accept, decline, cancel, edit, reschedule, payment status), month/week/day calendar, weekly hours, time off, lesson types and prices, students with history and private notes, reviews, email log and settings.

Built with Next.js 15 (App Router), PostgreSQL (Supabase-compatible), Tailwind CSS 4, GSAP + Lenis and Three.js.

## How booking safety works

- Availability is computed server-side from weekly hours, one-off blocks or extra hours, existing bookings, the buffer between lessons, minimum notice and the booking window (`src/lib/availability.ts`, unit tested).
- Every booking request is re-checked inside a database transaction before it is saved.
- A PostgreSQL **exclusion constraint** (`bookings_no_overlap`) makes overlapping active bookings impossible, even when two people book the same slot at the same moment. This is tested in `tests/booking.test.ts`.
- Cancelled or declined bookings free their slot immediately.
- Inputs are validated on both client and server (zod), there is a honeypot field, and booking and login attempts are rate limited.

## Setup

1. **Database**: create a Supabase project (or any Postgres 14+). Copy the connection string into `DATABASE_URL`.
2. **Environment**: copy `.env.example` to `.env.local` and fill it in.
3. **Install and migrate**
   ```bash
   npm install
   npm run db:migrate
   npm run create-admin -- you@example.com "Your Name"   # prompts for a password
   ```
4. **Run**: `npm run dev` and open http://localhost:3000 and http://localhost:3000/admin.
5. In the dashboard: add lesson types and prices, set weekly hours, then fill in Settings (name, contact details, areas covered). Sections without content stay hidden on the website, so nothing invented is shown.

## Deploy (Netlify)

- Connect the repo, set the base directory to `web`, and add the environment variables from `.env.example`.
- `netlify.toml` runs migrations, then builds.
- Point your domain at the site and set `NEXT_PUBLIC_SITE_URL` to it.
- Submit `https://your-domain/sitemap.xml` in Google Search Console.

## Email

Every email the system sends is recorded in **Dashboard > Emails**. Until a provider is configured (`EMAIL_PROVIDER=log`), emails are recorded but **not delivered**.
To go live with Resend: verify your domain in Resend, then set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM`.
To add another provider, add a driver in `src/server/email.ts`.

Emails sent:
- **Student**: request received or confirmed, confirmed, declined, cancelled (by either side), and lesson changed. Each includes the lesson details, the cancellation policy and a manage link.
- **Instructor**: new booking or request, and student cancellation.

## Payments

Students pay at the lesson by default. The booking and payment model is provider-agnostic (`payments` table, `payment_mode` and `payment_status` on bookings).
A Stripe Checkout integration is included but is **inactive until `STRIPE_SECRET_KEY` is set**:
- **With approval on**: the card is authorised at booking and only charged when you accept. Declining releases the hold. Stripe holds last about 7 days, so accept or decline within that time.
- **With approval off**: the card is charged at booking.
- Cancellations release or refund automatically.
- Unpaid holds are released after 30 minutes.
- Webhook: point Stripe at `https://your-domain/api/stripe/webhook` with event `checkout.session.completed`, and set `STRIPE_WEBHOOK_SECRET`.

The Stripe flow has not been run against a live Stripe account yet. Test it in Stripe test mode before switching it on.

## Tests

```bash
npm test          # availability engine + booking integration tests (needs DATABASE_URL)
npm run typecheck
npm run lint
```

## Media and credits

- The hero is rendered live by a WebGL shader (`src/components/site/HeroRoad.tsx`). `public/images/hero-poster.jpg` is a frame rendered from that same shader, shown as the fallback.
- Add an instructor photo in Settings (an https link, or a file in `public/images`).
- Icons: [Solar](https://www.figma.com/community/file/1166831539721848736) by 480 Design (CC BY 4.0). Social icons: [Simple Icons](https://simpleicons.org) (CC0).
