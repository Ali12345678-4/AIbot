import Link from "next/link";
import { getHomeData, getNextSlots, type BoardRow } from "@/server/public-data";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { HeroRoad } from "@/components/site/HeroRoad";
import { Timetable } from "@/components/site/Timetable";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { SplitHeading } from "@/components/motion/Split";
import { Icon } from "@/components/Icon";
import { JsonLd, businessJsonLd } from "@/components/site/JsonLd";
import { formatDuration, formatMoney } from "@/lib/format";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

const METHOD = [
  { t: "Patient", b: "Nerves are normal. Lessons are calm, encouraging and never rushed, so confidence builds naturally." },
  { t: "Structured", b: "Every lesson has a clear goal and a short debrief, so you always know what you’ve mastered and what’s next." },
  { t: "One‑to‑one", b: "Your lesson, your pace. Planned around how you learn, not a fixed script." },
  { t: "Test‑ready", b: "The skills, routes and situations that matter, practised until test day feels familiar." },
];

function faq(s: Settings) {
  return [
    { q: "How do I book?", a: "Pick a lesson, choose a free date and time, add your details and confirm. About two minutes, no account needed." },
    s.require_approval
      ? { q: "Is it confirmed straight away?", a: "Your time is reserved immediately while the instructor reviews it. You’ll get an email as soon as it’s confirmed." }
      : { q: "Is it confirmed straight away?", a: "Yes. The slot is yours the moment you book, and a confirmation email follows." },
    { q: "Can I cancel or move a lesson?", a: `Cancel free of charge up to ${s.cancellation_notice_hours} hours before using the link in your email. To move a lesson, get in touch and it will be rearranged.` },
    s.payment_mode === "pay_at_lesson"
      ? { q: "How do I pay?", a: "At the lesson. The price is always shown before you book." }
      : { q: "How do I pay?", a: "Securely online when you book. If your request isn’t accepted, you aren’t charged." },
  ];
}

export default async function HomePage() {
  const { settings: s, lessons, reviews } = await getHomeData();
  let board: BoardRow[] = [];
  try { board = await getNextSlots(s, lessons); } catch { /* board shows "opens soon" */ }
  const next = board[0];
  const firstName = s.instructor_name?.split(" ")[0];
  const quals = s.instructor_qualifications?.split("\n").map((q) => q.trim()).filter(Boolean) ?? [];
  const faqs = faq(s);
  const shortest = [...lessons].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
  const area = [s.locality, s.service_areas].filter(Boolean)[0];

  return (
    <>
      <JsonLd data={businessJsonLd(s, lessons)} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <MotionRoot />
      <SiteHeader overDark />

      <main id="main">
        {/* ================= HERO ================= */}
        <section data-hero-stage className="relative flex min-h-[100svh] flex-col bg-black pt-[60px]" aria-labelledby="hero-title">
          <div className="container-x flex flex-1 flex-col justify-center py-10">
            <div className="flex items-center justify-between border-b rule pb-4" data-reveal data-reveal-immediate>
              <span className="label">Driving school{area ? ` · ${area}` : ""}</span>
              <span className="label hidden sm:inline">Online booking · 24/7</span>
            </div>

            <h1 id="hero-title" className="mt-8 md:mt-12">
              <span className="sr-only">K444AXN Driving School. Learn to drive with confidence.</span>
              <span aria-hidden="true" className="wide block whitespace-nowrap text-[clamp(2.5rem,12.1vw,13.9rem)] leading-[0.82]" data-split data-split-immediate>
                {"K444 AXN".split("").map((ch, i) => (
                  <span key={i} className="split-word">{ch === " " ? " " : ch}</span>
                ))}
              </span>
            </h1>

            <div className="mt-8 grid gap-8 md:mt-12 md:grid-cols-[1.2fr_1fr] md:items-end">
              <p className="wide-md max-w-[22ch] text-[clamp(1.5rem,3.2vw,2.75rem)] leading-[1.05] text-ink" data-reveal data-reveal-immediate data-reveal-delay="0.45">
                Learn to drive with <span className="text-accent">confidence.</span>
              </p>
              <div className="flex flex-col gap-4 md:items-end" data-reveal data-reveal-immediate data-reveal-delay="0.6">
                {next && (
                  <Link href={`/book?lesson=${next.slug}&date=${next.date}`} className="mono group inline-flex items-center gap-3 text-[13px] text-muted hover:text-ink">
                    <span className="size-1.5 rounded-full bg-accent" />
                    NEXT FREE: <span className="text-ink">{next.day} · {next.time}</span>
                    <Icon name="arrow-right-linear" size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
                <div className="flex flex-wrap gap-3">
                  <Link href="/book" className="btn btn-primary btn-lg">Book a lesson <Icon name="arrow-right-linear" size={18} /></Link>
                  <a href="#timetable" className="btn btn-outline-light btn-lg">See free times</a>
                </div>
              </div>
            </div>
          </div>

          {/* Cinematic road strip: the only WebGL on the page. */}
          <div className="relative h-[34svh] min-h-[220px] overflow-hidden border-y rule" data-reveal data-reveal-immediate data-reveal-delay="0.3">
            <HeroRoad />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-black to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black to-transparent" />
            <div className="container-x pointer-events-none absolute inset-x-0 bottom-3 flex justify-between">
              <span className="label">The road ahead</span>
              <span className="label">Scroll</span>
            </div>
          </div>
        </section>

        {/* ================= 01 TIMETABLE ================= */}
        <section id="timetable" className="scroll-mt-16 bg-black py-24 md:py-36" aria-labelledby="tt-title">
          <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
            <div>
              <p className="sec-num" data-reveal>01 — Timetable</p>
              <SplitHeading text="Free times, live." id="tt-title" className="wide-md mt-4 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]" />
              <p className="mt-6 max-w-sm text-[1.0625rem] leading-relaxed text-muted" data-reveal>
                This board shows real open slots, straight from the diary. Tap one to book it. No account, no phone tag.
              </p>
              <Link href="/book" className="link-arrow mt-8 text-[15px] !text-ink" data-reveal>Open full calendar <Icon name="arrow-right-linear" size={16} /></Link>
            </div>
            <div data-reveal>
              <Timetable rows={board} durationLabel={shortest ? formatDuration(shortest.duration_minutes).toUpperCase() : ""} />
            </div>
          </div>
        </section>

        {/* ================= 02 LESSONS ================= */}
        <section id="lessons" className="scroll-mt-16 border-t rule bg-black py-24 md:py-36" aria-labelledby="lessons-title">
          <div className="container-x">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="sec-num" data-reveal>02 — Lessons</p>
                <SplitHeading text="One price list. No small print." id="lessons-title" className="wide-md mt-4 max-w-[16ch] text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]" />
              </div>
              <p className="max-w-xs text-[15px] leading-relaxed text-muted" data-reveal>Every lesson is one‑to‑one and planned around where you are.</p>
            </div>

            {lessons.length > 0 ? (
              <ul className="mt-14 border-t rule" data-reveal>
                {lessons.map((l, i) => (
                  <li key={l.id} className="border-b rule">
                    <Link href={`/book?lesson=${l.slug}`} className="row-link flex items-center gap-5 px-1 py-7 md:gap-8 md:px-4 md:py-9">
                      <span className="row-muted mono hidden w-10 shrink-0 text-[13px] text-faint sm:block">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="wide-md block text-[clamp(1.25rem,2.4vw,2rem)] leading-tight">
                          {l.name}{l.featured && <span className="row-muted mono ml-3 align-middle text-[11px] tracking-[0.14em] text-accent-ink">POPULAR</span>}
                        </span>
                        {l.description && <span className="row-muted mt-1 block max-w-xl text-[14px] leading-relaxed text-muted">{l.description}</span>}
                      </span>
                      <span className="row-muted mono hidden shrink-0 text-[13px] text-muted md:block">{formatDuration(l.duration_minutes).toUpperCase()}</span>
                      <span className="wide-md shrink-0 text-[clamp(1.5rem,2.6vw,2.25rem)]">{formatMoney(l.price_pence, s.currency)}</span>
                      <Icon name="arrow-right-linear" size={22} className="hidden shrink-0 md:block" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-14 border-y rule py-12" data-reveal>
                <p className="wide-md text-[clamp(1.5rem,3vw,2.5rem)]">Prices are being finalised.</p>
                <p className="mt-2 text-muted">The full price list will appear here shortly.{s.phone ? ` Call ${s.phone} in the meantime.` : ""}</p>
              </div>
            )}
          </div>
        </section>

        {/* ================= 03 THE CAR ================= */}
        <section id="car" className="scroll-mt-16 border-t rule bg-black py-24 md:py-36" aria-labelledby="car-title">
          <div className="container-x">
            <p className="sec-num" data-reveal>03 — The car</p>
            <div className="mt-4 grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-end">
              <SplitHeading text="Black Audi A3 S line." id="car-title" className="wide text-[clamp(2.5rem,7vw,6.5rem)] leading-[0.9]" />
              <p className="max-w-sm text-[1.0625rem] leading-relaxed text-muted lg:justify-self-end" data-reveal>
                Lessons are taught in the instructor’s own car: a black Audi A3 S line Black Edition.
              </p>
            </div>
            <dl className="mt-14 grid grid-cols-2 border-t rule md:grid-cols-4" data-reveal>
              {[
                ["Model", "A3 S line"],
                ["Edition", "Black Edition"],
                ["Engine", "35 TFSI"],
                ["Registration", "K444 AXN"],
              ].map(([k, v], i) => (
                <div key={k} className={`border-b rule py-6 pr-4 ${i % 2 ? "pl-4 md:pl-6" : ""} ${i > 0 ? "md:border-l md:pl-6" : ""}`}>
                  <dt className="label">{k}</dt>
                  <dd className="wide-md mt-2 text-[clamp(1.125rem,2vw,1.625rem)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ================= 04 METHOD ================= */}
        <section id="why" className="scroll-mt-16 border-t rule bg-black py-24 md:py-36" aria-labelledby="method-title">
          <div className="container-x grid gap-14 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="sec-num" data-reveal>04 — Method</p>
              <SplitHeading text="How lessons work." id="method-title" className="wide-md mt-4 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]" />
            </div>
            <ol className="border-t rule">
              {METHOD.map((m, i) => (
                <li key={m.t} className="grid grid-cols-[3rem_1fr] gap-x-6 border-b rule py-10 md:grid-cols-[5rem_14rem_1fr] md:py-12" data-reveal>
                  <span className="mono pt-2 text-[13px] text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="wide-md text-[clamp(1.5rem,2.6vw,2.25rem)] leading-none">{m.t}</h3>
                  <p className="col-start-2 mt-3 max-w-md text-[1.0625rem] leading-relaxed text-muted md:col-start-3 md:mt-0">{m.b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ================= 05 INSTRUCTOR ================= */}
        <section id="about" className="scroll-mt-16 border-t rule bg-black py-24 md:py-36" aria-labelledby="about-title">
          <div className="container-x">
            <p className="sec-num" data-reveal>05 — Instructor</p>
            <div className="mt-4 grid gap-14 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
              <div>
                <SplitHeading text={firstName ? `Hi, I’m ${firstName}.` : "Your instructor."} id="about-title" className="wide-md text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]" />
                <div className="mt-8 max-w-2xl space-y-5 text-[clamp(1.125rem,1.6vw,1.375rem)] leading-[1.55] text-ink-2" data-reveal>
                  {(s.instructor_bio || "Learning to drive should feel exciting, not stressful. Every lesson is one‑to‑one, carefully structured and focused on building real, lasting confidence on the road.")
                    .split("\n").filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
                </div>
                {s.teaching_approach && <p className="mt-8 max-w-xl border-l-2 border-accent pl-5 text-[1.0625rem] italic leading-relaxed text-ink" data-reveal>{s.teaching_approach}</p>}
              </div>
              <div className="lg:pt-4">
                {s.instructor_photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.instructor_photo_url} alt={s.instructor_name ? `${s.instructor_name}, driving instructor` : "Your driving instructor"} className="mb-8 aspect-[4/5] w-full rounded-[20px] object-cover grayscale-[20%]" loading="lazy" data-reveal />
                )}
                <dl className="border-t rule" data-reveal>
                  {s.instructor_name && <div className="flex justify-between gap-6 border-b rule py-4"><dt className="label">Name</dt><dd className="text-right">{s.instructor_name}</dd></div>}
                  {s.years_experience ? <div className="flex justify-between gap-6 border-b rule py-4"><dt className="label">Teaching</dt><dd>{s.years_experience}+ years</dd></div> : null}
                  {quals.map((q) => <div key={q} className="flex justify-between gap-6 border-b rule py-4"><dt className="label">Qualified</dt><dd className="text-right">{q}</dd></div>)}
                  <div className="flex justify-between gap-6 border-b rule py-4"><dt className="label">Lessons</dt><dd>One‑to‑one</dd></div>
                  <div className="flex justify-between gap-6 border-b rule py-4"><dt className="label">Cancellation</dt><dd>Free up to {s.cancellation_notice_hours}h before</dd></div>
                </dl>
                <Link href="/book" className="btn btn-primary mt-8">Book with {firstName ?? "us"} <Icon name="arrow-right-linear" size={16} /></Link>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 06 REVIEWS ================= */}
        <section id="reviews" className="scroll-mt-16 border-t rule bg-black py-24 md:py-36" aria-labelledby="reviews-title">
          <div className="container-x">
            <p className="sec-num" data-reveal>06 — Reviews</p>
            <SplitHeading text="Word of mouth." id="reviews-title" className="wide-md mt-4 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]" />
            {reviews.length > 0 ? (
              <ul className="mt-14 grid gap-px overflow-hidden rounded-[20px] border rule bg-line md:grid-cols-2 lg:grid-cols-3">
                {reviews.map((r) => (
                  <li key={r.id} className="bg-black p-8 md:p-10" data-reveal>
                    <figure>
                      {r.rating ? <p className="mono text-[13px] text-accent" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}<span className="text-faint">{"★".repeat(5 - r.rating)}</span></p> : null}
                      <blockquote className="mt-4 text-[1.125rem] leading-relaxed text-ink">“{r.body}”</blockquote>
                      <figcaption className="label mt-6">{r.author_name}{r.source ? ` · ${r.source}` : ""}</figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-14 grid gap-6 border-y rule py-12 md:grid-cols-[1fr_auto] md:items-center" data-reveal>
                <p className="max-w-xl text-[1.125rem] leading-relaxed text-muted">Only genuine reviews from real students appear here, and the first are on their way. Book a lesson and you could be one of them.</p>
                <Link href="/book" className="btn btn-outline-light">Book a lesson</Link>
              </div>
            )}
          </div>
        </section>

        {/* ================= 07 QUESTIONS ================= */}
        <section className="border-t rule bg-black py-24 md:py-36" aria-labelledby="faq-title">
          <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
            <div>
              <p className="sec-num" data-reveal>07 — Questions</p>
              <SplitHeading text="Before you book." id="faq-title" className="wide-md mt-4 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]" />
            </div>
            <dl className="border-t rule" data-reveal>
              {faqs.map((f) => (
                <div key={f.q} className="grid gap-2 border-b rule py-7 md:grid-cols-[16rem_1fr] md:gap-8">
                  <dt className="text-[1.0625rem] font-semibold">{f.q}</dt>
                  <dd className="text-[1.0625rem] leading-relaxed text-muted">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ================= CTA ================= */}
        <section className="relative overflow-hidden border-t rule bg-accent text-white" aria-labelledby="cta-title">
          <Link href="/book" className="group block">
            <div className="container-x flex flex-col gap-6 py-20 md:py-28">
              <span className="mono text-[13px] tracking-[0.12em] text-white/70">READY WHEN YOU ARE</span>
              <h2 id="cta-title" className="wide text-[clamp(3rem,11vw,11rem)] leading-[0.85]">
                Book your<br />first lesson
                <Icon name="arrow-right-linear" size={96} className="ml-4 inline-block size-[0.7em] align-baseline transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-4" />
              </h2>
            </div>
          </Link>
        </section>
      </main>

      <SiteFooter settings={s} />
    </>
  );
}
