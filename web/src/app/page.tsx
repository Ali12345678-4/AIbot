import Link from "next/link";
import { getHomeData } from "@/server/public-data";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { HeroRoad } from "@/components/site/HeroRoad";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { SplitHeading, ScrubStatement } from "@/components/motion/Split";
import { Icon, type IconName } from "@/components/Icon";
import { Plate } from "@/components/site/Logo";
import { JsonLd, businessJsonLd } from "@/components/site/JsonLd";
import { formatDuration, formatMoney } from "@/lib/format";
import type { Settings } from "@/lib/types";

export const revalidate = 300;

const WHY: { icon: IconName; title: string; body: string }[] = [
  { icon: "user-heart-linear", title: "Personalised to you", body: "Every lesson is planned around your goals, your pace and how you learn best. No two learners are the same." },
  { icon: "shield-check-linear", title: "Professional instruction", body: "Clear explanations, structured progress and a strong focus on safe, independent driving for life." },
  { icon: "calendar-linear", title: "Flexible scheduling", body: "See real availability and book the times that work around school, work and everything else." },
  { icon: "hand-heart-linear", title: "Calm and supportive", body: "Nerves are normal. Lessons are relaxed, encouraging and judgement‑free, so you can build confidence." },
  { icon: "route-linear", title: "Ready for test day", body: "Practise the skills and situations that matter, so you walk into your test prepared." },
  { icon: "clock-circle-linear", title: "Book online, any time", body: "No phone tag. Choose a lesson, pick a slot and get instant confirmation of your request by email." },
];

function faq(s: Settings) {
  const items = [
    { q: "How do I book a lesson?", a: "Choose a lesson type, pick a date and time from the live calendar, add your details and confirm. It takes about two minutes and you don’t need an account." },
    s.require_approval
      ? { q: "Is my lesson confirmed straight away?", a: "Your time is reserved immediately while the instructor reviews your request. You’ll receive an email as soon as it’s confirmed." }
      : { q: "Is my lesson confirmed straight away?", a: "Yes. As soon as you book, the slot is yours and you’ll receive a confirmation email." },
    { q: "Can I cancel or reschedule?", a: `Yes. You can cancel free of charge up to ${s.cancellation_notice_hours} hours before your lesson using the link in your confirmation email. To move a lesson, get in touch and it will be updated for you.` },
    s.payment_mode === "pay_at_lesson"
      ? { q: "How do I pay?", a: "Payment is taken at the lesson. The price is shown clearly before you book." }
      : { q: "How do I pay?", a: "You pay securely online when you book. If your request isn’t accepted, your card is never charged." },
  ];
  return items;
}

export default async function HomePage() {
  const { settings: s, lessons, reviews } = await getHomeData();
  const firstName = s.instructor_name?.split(" ")[0];
  const quals = s.instructor_qualifications?.split("\n").map((q) => q.trim()).filter(Boolean) ?? [];
  const faqs = faq(s);

  return (
    <>
      <JsonLd data={businessJsonLd(s, lessons)} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <MotionRoot />
      <SiteHeader overDark />

      <main id="main">
        {/* ---------------- Hero ---------------- */}
        <section className="on-dark relative isolate flex min-h-[100svh] items-end overflow-hidden bg-night text-white" aria-labelledby="hero-title">
          <HeroRoad />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-night/90 via-night/30 to-transparent" />
          <div className="container-x relative pb-[12vh] pt-32 md:pb-[14vh]">
            <p className="eyebrow !text-white/60" data-reveal data-reveal-immediate>K444AXN Driving School</p>
            <SplitHeading as="h1" id="hero-title" immediate text="Learn to drive with confidence." className="display-xl mt-4 max-w-[11ch] text-balance" />
            <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-white/75 md:text-xl" data-reveal data-reveal-immediate data-reveal-delay="0.5">
              Calm, patient lessons shaped around you, from your very first drive to test day. Pick a time that suits you and book online in minutes.
            </p>
            <div className="mt-9 flex flex-wrap gap-3" data-reveal data-reveal-immediate data-reveal-delay="0.65">
              <Link href="/book" className="btn btn-light btn-lg">
                Book a lesson <Icon name="arrow-right-linear" size={18} />
              </Link>
              <a href="#about" className="btn btn-outline-light btn-lg">Learn more</a>
            </div>
          </div>
        </section>

        {/* ---------------- Statement ---------------- */}
        <section className="bg-paper py-28 md:py-40" aria-label="Our promise">
          <div className="container-x">
            <ScrubStatement
              className="mx-auto max-w-4xl text-center font-display text-[clamp(1.75rem,4vw,3.25rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-ink"
              text="Every confident driver started exactly where you are now. Our job is to take you from first lesson to full licence, safely, calmly and at your pace."
            />
          </div>
        </section>

        {/* ---------------- Lessons ---------------- */}
        <section id="lessons" className="scroll-mt-16 bg-canvas py-24 md:py-32" aria-labelledby="lessons-title">
          <div className="container-x">
            <div className="max-w-2xl">
              <p className="eyebrow" data-reveal>Lessons &amp; prices</p>
              <SplitHeading text="Choose the lesson that fits." id="lessons-title" className="display-lg mt-3" />
              <p className="lede mt-5" data-reveal>Clear prices, no surprises. Every lesson is one‑to‑one and tailored to where you are on your journey.</p>
            </div>

            {lessons.length > 0 ? (
              <ul className={`mt-14 grid gap-5 ${lessons.length === 1 ? "max-w-md" : lessons.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
                {lessons.map((l, i) => (
                  <li key={l.id} data-reveal data-reveal-delay={String((i % 3) * 0.08)}>
                    <article className={`card card-hover flex h-full flex-col p-8 ${l.featured ? "ring-2 ring-accent" : ""}`}>
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-display text-[1.5rem] font-bold tracking-[-0.02em]">{l.name}</h3>
                        {l.featured && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-ink">Popular</span>}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Icon name="clock-circle-linear" size={16} />{formatDuration(l.duration_minutes)}</p>
                      {l.description && <p className="mt-5 flex-1 text-[15px] leading-relaxed text-ink-2">{l.description}</p>}
                      <div className="mt-8 flex items-end justify-between gap-4 border-t border-line pt-6">
                        <p>
                          <span className="font-display text-[2.25rem] font-bold tracking-[-0.03em]">{formatMoney(l.price_pence, s.currency)}</span>
                        </p>
                        <Link href={`/book?lesson=${l.slug}`} className="btn btn-primary" aria-label={`Book ${l.name}`}>Book</Link>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="card mt-14 flex flex-col items-start gap-4 p-8 md:flex-row md:items-center md:justify-between" data-reveal>
                <div>
                  <h3 className="text-lg font-semibold">Lesson options are being finalised.</h3>
                  <p className="mt-1 text-[15px] text-muted">Prices and lesson types will appear here shortly.</p>
                </div>
                {s.phone && <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="btn btn-secondary">Call {s.phone}</a>}
              </div>
            )}
          </div>
        </section>

        {/* ---------------- About ---------------- */}
        <section id="about" className="scroll-mt-16 bg-paper py-24 md:py-32" aria-labelledby="about-title">
          <div className="container-x grid items-center gap-14 md:grid-cols-2 md:gap-20">
            <div className="relative order-last md:order-first" data-reveal>
              {s.instructor_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.instructor_photo_url} alt={s.instructor_name ? `${s.instructor_name}, driving instructor` : "Your driving instructor"} className="aspect-[4/5] w-full rounded-[28px] object-cover" loading="lazy" />
              ) : (
                <div className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-[28px] bg-night">
                  <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_100%,rgba(214,120,70,.45),transparent_60%)]" />
                  <div className="relative text-center">
                    <Plate dark className="!px-5 !py-2 !text-[2.25rem] md:!text-[3rem]" />
                    <p className="mt-5 text-sm font-medium tracking-wide text-white/60">Driving School</p>
                  </div>
                </div>
              )}
            </div>
            <div>
              <p className="eyebrow" data-reveal>Meet your instructor</p>
              <SplitHeading text={firstName ? `Hi, I’m ${firstName}.` : "Lessons built around you."} id="about-title" className="display-lg mt-3" />
              <div className="mt-6 space-y-4 text-[1.0625rem] leading-relaxed text-ink-2" data-reveal>
                {(s.instructor_bio || "Learning to drive should feel exciting, not stressful. Every lesson is one‑to‑one, carefully structured and focused on building real confidence on the road.")
                  .split("\n").filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
              </div>
              {s.teaching_approach && (
                <div className="mt-8 rounded-2xl bg-mist p-6" data-reveal>
                  <h3 className="text-sm font-semibold text-ink">Teaching approach</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.teaching_approach}</p>
                </div>
              )}
              {(quals.length > 0 || s.years_experience) && (
                <ul className="mt-8 grid gap-3 sm:grid-cols-2" data-reveal>
                  {s.years_experience ? (
                    <li className="flex items-center gap-3 text-[15px]"><Icon name="medal-ribbons-star-linear" size={22} className="text-accent" />{s.years_experience}+ years teaching</li>
                  ) : null}
                  {quals.map((q) => (
                    <li key={q} className="flex items-center gap-3 text-[15px]"><Icon name="check-circle-linear" size={22} className="text-accent" />{q}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ---------------- Why ---------------- */}
        <section id="why" className="scroll-mt-16 bg-canvas py-24 md:py-32" aria-labelledby="why-title">
          <div className="container-x">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow" data-reveal>Why K444AXN</p>
              <SplitHeading text="Everything you need to pass. Nothing you don’t." id="why-title" className="display-lg mt-3" />
            </div>
            <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {WHY.map((w, i) => (
                <li key={w.title} data-reveal data-reveal-delay={String((i % 3) * 0.08)}>
                  <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Icon name={w.icon} size={24} /></span>
                  <h3 className="mt-5 text-[1.1875rem] font-semibold tracking-[-0.015em]">{w.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{w.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------- How booking works ---------------- */}
        <section className="bg-paper py-24 md:py-32" aria-labelledby="how-title">
          <div className="container-x">
            <div className="max-w-2xl">
              <p className="eyebrow" data-reveal>How it works</p>
              <SplitHeading text="Booked in three simple steps." id="how-title" className="display-lg mt-3" />
            </div>
            <ol className="mt-14 grid gap-5 md:grid-cols-3">
              {[
                { n: "01", t: "Choose your lesson", b: "Pick the lesson length that suits you, with the price shown up front." },
                { n: "02", t: "Pick a date and time", b: "Only genuinely available slots are shown, updated in real time." },
                { n: "03", t: "Get confirmation", b: s.require_approval ? "Your time is reserved instantly, then confirmed by email." : "Your lesson is confirmed instantly by email." },
              ].map((step, i) => (
                <li key={step.n} className="rounded-[var(--radius-card)] bg-mist p-8" data-reveal data-reveal-delay={String(i * 0.08)}>
                  <span className="font-display text-sm font-bold tracking-[0.08em] text-accent">{step.n}</span>
                  <h3 className="mt-6 text-[1.375rem] font-semibold tracking-[-0.02em]">{step.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------- Reviews ---------------- */}
        <section id="reviews" className="scroll-mt-16 bg-canvas py-24 md:py-32" aria-labelledby="reviews-title">
          <div className="container-x">
            <div className="max-w-2xl">
              <p className="eyebrow" data-reveal>Reviews</p>
              <SplitHeading text="In our students’ words." id="reviews-title" className="display-lg mt-3" />
            </div>
            {reviews.length > 0 ? (
              <ul className="mt-14 columns-1 gap-5 md:columns-2 lg:columns-3 [&>li]:mb-5">
                {reviews.map((r) => (
                  <li key={r.id} className="break-inside-avoid" data-reveal>
                    <figure className="card p-8">
                      {r.rating ? (
                        <div className="flex gap-0.5 text-[#f5a623]" aria-label={`${r.rating} out of 5 stars`} role="img">
                          {Array.from({ length: 5 }, (_, i) => <Icon key={i} name={i < r.rating! ? "star-bold" : "star-linear"} size={16} />)}
                        </div>
                      ) : null}
                      <blockquote className="mt-4 text-[1.0625rem] leading-relaxed text-ink">“{r.body}”</blockquote>
                      <figcaption className="mt-5 text-sm font-semibold">{r.author_name}{r.source && <span className="font-normal text-muted"> · {r.source}</span>}</figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-14 grid gap-5 md:grid-cols-3" data-reveal>
                <div className="card flex flex-col justify-between p-8 md:col-span-2">
                  <Icon name="chat-round-line-linear" size={28} className="text-accent" />
                  <div className="mt-10">
                    <h3 className="text-xl font-semibold tracking-[-0.015em]">Genuine reviews only.</h3>
                    <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">We only publish real feedback from students we’ve taught. The first reviews will appear here soon.</p>
                  </div>
                </div>
                <div className="rounded-[var(--radius-card)] bg-accent p-8 text-white">
                  <h3 className="text-xl font-semibold tracking-[-0.015em]">Be one of the first.</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/75">Book your first lesson and start your journey.</p>
                  <Link href="/book" className="btn btn-light mt-8">Book a lesson</Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="bg-paper py-24 md:py-32" aria-labelledby="faq-title">
          <div className="container-x grid gap-12 md:grid-cols-[1fr_1.5fr]">
            <div>
              <p className="eyebrow" data-reveal>Questions</p>
              <SplitHeading text="Good to know." id="faq-title" className="display-lg mt-3" />
            </div>
            <div className="divide-y divide-line border-y border-line" data-reveal>
              {faqs.map((f) => (
                <details key={f.q} className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.0625rem] font-semibold tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Icon name="alt-arrow-down-linear" size={20} className="shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <p className="pb-5 pr-10 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Final CTA ---------------- */}
        <section className="on-dark relative overflow-hidden bg-night py-28 text-center text-white md:py-40" aria-labelledby="cta-title">
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_120%,rgba(214,120,70,.35),transparent_70%)]" aria-hidden="true" />
          <div className="container-x relative">
            <SplitHeading text="Your licence starts with one lesson." id="cta-title" className="display-lg mx-auto max-w-3xl text-balance" />
            <p className="mx-auto mt-5 max-w-lg text-lg text-white/70" data-reveal>Pick a time that suits you. It only takes a couple of minutes.</p>
            <div className="mt-10" data-reveal>
              <Link href="/book" className="btn btn-light btn-lg">Book your first lesson <Icon name="arrow-right-linear" size={18} /></Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter settings={s} />
    </>
  );
}
