"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, shiftMonth } from "./Calendar";
import { Icon } from "../Icon";
import { EXPERIENCE_OPTIONS, experienceLabel, type LessonType, type PaymentMode } from "@/lib/types";
import { formatDuration, formatMoney } from "@/lib/format";
import { studentDetailsSchema } from "@/lib/validation";

interface Slot { startsAt: string; label: string; endLabel: string }
interface Details { fullName: string; phone: string; email: string; experience: string; message: string }
type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS = ["Lesson", "Date", "Time", "Details", "Review"] as const;

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function BookingFlow(props: {
  lessons: LessonType[];
  initialLessonSlug?: string;
  currency: string;
  timezone: string;
  requireApproval: boolean;
  paymentMode: PaymentMode;
  depositPence: number;
  cancellationHours: number;
  today: string;
  lastDate: string;
  contactPhone: string | null;
  cancelledRef?: string;
}) {
  const { lessons, currency } = props;
  const initial = lessons.find((l) => l.slug === props.initialLessonSlug) ?? (lessons.length === 1 ? lessons[0] : undefined);
  const [step, setStep] = useState<Step>(initial ? 2 : 1);
  const [lesson, setLesson] = useState<LessonType | undefined>(initial);
  const [month, setMonth] = useState(props.today.slice(0, 7));
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [datesLoading, setDatesLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [details, setDetails] = useState<Details>({ fullName: "", phone: "", email: "", experience: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Details | "consent", string>>>({});
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(
    props.cancelledRef ? { kind: "info", text: "Payment was cancelled, so your booking wasn’t completed. You can choose a time again below." } : null,
  );
  const [result, setResult] = useState<{ reference: string; manageToken?: string; status: string } | null>(null);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const minMonth = props.today.slice(0, 7);
  const maxMonth = props.lastDate.slice(0, 7);

  // Focus the step heading on step change for screen readers and keyboard users.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [step]);

  const loadDates = useCallback(async (l: LessonType, m: string, signal?: AbortSignal) => {
    setDatesLoading(true);
    try {
      const [y, mo] = m.split("-").map(Number);
      const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const res = await fetch(`/api/availability/dates?lesson=${l.id}&from=${m}-01&to=${m}-${String(last).padStart(2, "0")}`, { signal, cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDates(new Set(data.dates as string[]));
      return data.dates as string[];
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNotice({ kind: "error", text: "We couldn’t load availability. Please check your connection and try again." });
      return [];
    } finally {
      if (!signal?.aborted) setDatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lesson || step !== 2) return;
    const ac = new AbortController();
    loadDates(lesson, month, ac.signal);
    return () => ac.abort();
  }, [lesson, month, step, loadDates]);

  // If the current month has nothing, find the next month with availability.
  useEffect(() => {
    if (!lesson || step !== 2 || datesLoading || dates.size) { setNextAvailable(null); return; }
    let cancelled = false;
    (async () => {
      for (let m = shiftMonth(month, 1); m <= maxMonth; m = shiftMonth(m, 1)) {
        const [y, mo] = m.split("-").map(Number);
        const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
        const res = await fetch(`/api/availability/dates?lesson=${lesson.id}&from=${m}-01&to=${m}-${String(last).padStart(2, "0")}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (d.dates.length) { if (!cancelled) setNextAvailable(m); return; }
      }
    })();
    return () => { cancelled = true; };
  }, [lesson, step, dates, datesLoading, month, maxMonth]);

  const loadSlots = useCallback(async (l: LessonType, d: string) => {
    setSlots(null);
    try {
      const res = await fetch(`/api/availability/slots?lesson=${l.id}&date=${d}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSlots(data.slots);
    } catch {
      setSlots([]);
      setNotice({ kind: "error", text: "We couldn’t load times for that day. Please try again." });
    }
  }, []);

  const go = (s: Step) => { setNotice(null); setStep(s); };

  const chooseLesson = (l: LessonType) => {
    setLesson(l);
    setDate(null);
    setSlot(null);
    go(2);
  };
  const chooseDate = (d: string) => {
    setDate(d);
    setSlot(null);
    if (lesson) loadSlots(lesson, d);
    go(3);
  };
  const chooseSlot = (s: Slot) => { setSlot(s); go(4); };

  const validateDetails = () => {
    const r = studentDetailsSchema.safeParse(details);
    const errs: typeof errors = {};
    if (!r.success) for (const i of r.error.issues) errs[i.path[0] as keyof Details] ??= i.message;
    if (!consent) errs.consent = "Please accept the terms to continue.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`f-${first}`)?.focus();
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!lesson || !slot || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...details, lessonTypeId: lesson.id, startsAt: slot.startsAt, consent, website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setSlot(null);
        if (date) loadSlots(lesson, date);
        setStep(3);
        setNotice({ kind: "error", text: data.error ?? "That time was just taken. Please choose another." });
        return;
      }
      if (res.status === 422 && data.fieldErrors) {
        setErrors(data.fieldErrors);
        setStep(4);
        setNotice({ kind: "error", text: data.error });
        return;
      }
      if (!res.ok) {
        setNotice({ kind: "error", text: data.error ?? "Something went wrong. Please try again." });
        return;
      }
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setResult(data);
      setStep(6);
    } catch {
      setNotice({ kind: "error", text: "We couldn’t reach the server. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = useMemo(() => {
    if (!slots) return null;
    const g: { label: string; items: Slot[] }[] = [
      { label: "Morning", items: [] },
      { label: "Afternoon", items: [] },
      { label: "Evening", items: [] },
    ];
    for (const s of slots) {
      const h = Number(s.label.slice(0, 2));
      g[h < 12 ? 0 : h < 17 ? 1 : 2].items.push(s);
    }
    return g.filter((x) => x.items.length);
  }, [slots]);

  const due = !lesson ? 0 : props.paymentMode === "full" ? lesson.price_pence : props.paymentMode === "deposit" ? Math.min(lesson.price_pence, props.depositPence) : 0;
  const payingOnline = props.paymentMode !== "pay_at_lesson" && due > 0;

  if (!lessons.length) {
    return (
      <div className="card mx-auto max-w-xl p-10 text-center">
        <Icon name="calendar-linear" size={32} className="mx-auto text-accent" />
        <h1 className="mt-5 font-display text-2xl font-bold tracking-[-0.02em]">Online booking opens soon.</h1>
        <p className="mt-3 text-muted">Lesson options are being finalised. {props.contactPhone ? <>In the meantime, call <a className="text-accent underline" href={`tel:${props.contactPhone.replace(/[^\d+]/g, "")}`}>{props.contactPhone}</a>.</> : "Please check back shortly."}</p>
        <Link href="/" className="btn btn-ghost mt-8">Back to home</Link>
      </div>
    );
  }

  // ---------- Confirmation ----------
  if (step === 6 && result && lesson && slot && date) {
    const pending = result.status === "pending";
    return (
      <div className="mx-auto max-w-xl text-center animate-rise">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-ok-soft text-ok">
          <Icon name="check-circle-bold" size={36} />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-display text-[2.5rem] font-bold leading-tight tracking-[-0.03em] outline-none">
          {pending ? "Request received." : "You’re booked in."}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-lg text-ink-2">
          {pending
            ? `Your time is reserved. We’ve emailed ${details.email} and you’ll hear back as soon as it’s confirmed.`
            : `A confirmation has been sent to ${details.email}.`}
        </p>
        <dl className="card mt-10 divide-y divide-line text-left">
          {[
            ["Reference", result.reference],
            ["Lesson", lesson.name],
            ["Date", longDate(date)],
            ["Time", `${slot.label} – ${slot.endLabel}`],
            ["Price", formatMoney(lesson.price_pence, currency)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 px-6 py-4">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => downloadIcs(result.reference, lesson, slot.startsAt)}>
            <Icon name="calendar-add-linear" size={18} /> Add to calendar
          </button>
          {result.manageToken && (
            <Link href={`/booking/manage/${result.manageToken}`} className="btn btn-secondary">Manage booking</Link>
          )}
          <Link href="/" className="btn btn-primary">Done</Link>
        </div>
        <p className="mt-8 text-sm text-muted">Need to cancel? You can do it free of charge up to {props.cancellationHours} hours before, using the link in your email.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
      <div className="min-w-0">
        {/* Progress */}
        <nav aria-label="Booking progress" className="mb-10">
          <ol className="flex items-center gap-2">
            {STEPS.map((label, i) => {
              const n = (i + 1) as Step;
              const done = step > n;
              const current = step === n;
              const reachable = n < step;
              return (
                <li key={label} className="flex flex-1 flex-col gap-2">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => go(n)}
                    aria-current={current ? "step" : undefined}
                    className="group flex flex-col gap-2 text-left disabled:cursor-default"
                  >
                    <span className={`h-1 w-full rounded-full transition-colors duration-500 ${done || current ? "bg-accent" : "bg-line"}`} />
                    <span className={`hidden text-[12px] font-semibold sm:block ${current ? "text-ink" : done ? "text-accent group-hover:underline" : "text-faint"}`}>
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[13px] font-medium text-muted sm:hidden">Step {Math.min(step, 5)} of 5 · {STEPS[Math.min(step, 5) - 1]}</p>
        </nav>

        {notice && (
          <div role={notice.kind === "error" ? "alert" : "status"} className={`mb-8 flex items-start gap-3 rounded-2xl px-5 py-4 text-[15px] animate-rise ${notice.kind === "error" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-ink"}`}>
            <Icon name={notice.kind === "error" ? "danger-triangle-linear" : "info-circle-linear"} size={20} className="mt-0.5 shrink-0" />
            <p>{notice.text}</p>
          </div>
        )}

        <div key={step} className="animate-rise">
          {step === 1 && (
            <section aria-labelledby="step-title">
              <StepHeading ref={headingRef} eyebrow="Step 1" title="Choose your lesson." />
              <ul className="mt-8 grid gap-4">
                {lessons.map((l) => {
                  const sel = lesson?.id === l.id;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => chooseLesson(l)}
                        aria-pressed={sel}
                        className={`card card-hover flex w-full items-center gap-5 p-6 text-left ${sel ? "ring-2 ring-accent" : ""}`}
                      >
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><Icon name="wheel-linear" size={24} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[1.125rem] font-semibold tracking-[-0.015em]">{l.name}</span>
                            {l.featured && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">Popular</span>}
                          </span>
                          <span className="mt-0.5 block text-sm text-muted">{formatDuration(l.duration_minutes)}</span>
                          {l.description && <span className="mt-2 block text-[14px] leading-relaxed text-ink-2">{l.description}</span>}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-display text-[1.5rem] font-bold tracking-[-0.02em]">{formatMoney(l.price_pence, currency)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {step === 2 && lesson && (
            <section aria-labelledby="step-title">
              <StepHeading ref={headingRef} eyebrow="Step 2" title="Pick a date." sub="Highlighted days have availability." />
              <div className="card mt-8 p-5 sm:p-8">
                <Calendar
                  month={month}
                  onMonthChange={setMonth}
                  available={dates}
                  loading={datesLoading}
                  selected={date}
                  onSelect={chooseDate}
                  minMonth={minMonth}
                  maxMonth={maxMonth}
                  today={props.today}
                />
                {!datesLoading && dates.size === 0 && (
                  <div className="mt-6 rounded-2xl bg-mist px-5 py-4 text-[15px] text-ink-2" role="status">
                    No availability this month.{" "}
                    {nextAvailable ? (
                      <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setMonth(nextAvailable)}>
                        Jump to next available month
                      </button>
                    ) : props.contactPhone ? (
                      <>Please call <a className="font-semibold text-accent" href={`tel:${props.contactPhone.replace(/[^\d+]/g, "")}`}>{props.contactPhone}</a>.</>
                    ) : null}
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 3 && lesson && date && (
            <section aria-labelledby="step-title">
              <StepHeading ref={headingRef} eyebrow="Step 3" title="Choose a time." sub={longDate(date)} />
              <div className="mt-8">
                {!grouped ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="Loading times">
                    {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-[52px]" />)}
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="card p-8 text-center">
                    <p className="font-semibold">No times left on this day.</p>
                    <button type="button" className="btn btn-ghost mt-5" onClick={() => go(2)}>Choose another date</button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {grouped.map((g) => (
                      <fieldset key={g.label}>
                        <legend className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{g.label}</legend>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          {g.items.map((s) => {
                            const sel = slot?.startsAt === s.startsAt;
                            return (
                              <button
                                key={s.startsAt}
                                type="button"
                                aria-pressed={sel}
                                aria-label={`${s.label} to ${s.endLabel}`}
                                onClick={() => chooseSlot(s)}
                                className={`h-[52px] rounded-2xl text-[15px] font-semibold tabular-nums transition-all duration-200 active:scale-[0.97] ${
                                  sel ? "bg-accent text-white" : "bg-paper text-ink shadow-[0_0_0_1px_var(--color-line-strong)] hover:shadow-[0_0_0_1.5px_var(--color-accent)]"
                                }`}
                              >
                                {s.label}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
                <button type="button" className="link-arrow mt-10 text-[15px]" onClick={() => go(2)}>
                  <Icon name="alt-arrow-left-linear" size={16} /> Change date
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section aria-labelledby="step-title">
              <StepHeading ref={headingRef} eyebrow="Step 4" title="Your details." sub="So we can confirm your lesson and keep you updated." />
              <form
                className="mt-8 grid gap-5"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (validateDetails()) go(5);
                }}
              >
                <Field id="fullName" label="Full name" error={errors.fullName}>
                  <input id="f-fullName" className="field" autoComplete="name" value={details.fullName} onChange={(e) => setDetails({ ...details, fullName: e.target.value })} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "e-fullName" : undefined} required />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="phone" label="Phone number" error={errors.phone}>
                    <input id="f-phone" className="field" type="tel" inputMode="tel" autoComplete="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "e-phone" : undefined} required />
                  </Field>
                  <Field id="email" label="Email address" error={errors.email}>
                    <input id="f-email" className="field" type="email" inputMode="email" autoComplete="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} aria-invalid={!!errors.email} aria-describedby={errors.email ? "e-email" : undefined} required />
                  </Field>
                </div>
                <Field id="experience" label="Driving experience" error={errors.experience}>
                  <select id="f-experience" className="field" value={details.experience} onChange={(e) => setDetails({ ...details, experience: e.target.value })} aria-invalid={!!errors.experience} aria-describedby={errors.experience ? "e-experience" : undefined} required>
                    <option value="" disabled>Select one</option>
                    {EXPERIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field id="message" label="Anything we should know?" hint="Optional. Pickup location, nerves, test date — anything helpful." error={errors.message}>
                  <textarea id="f-message" className="field" maxLength={1000} value={details.message} onChange={(e) => setDetails({ ...details, message: e.target.value })} aria-invalid={!!errors.message} aria-describedby="h-message" />
                </Field>
                {/* Honeypot: hidden from people, tempting for bots. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
                  <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
                </div>
                <div>
                  <label className="flex items-start gap-3 text-[15px] text-ink-2">
                    <input id="f-consent" type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "e-consent" : undefined} />
                    <span>I agree to the <Link href="/terms" target="_blank" className="text-accent underline">terms &amp; cancellation policy</Link> and the <Link href="/privacy" target="_blank" className="text-accent underline">privacy policy</Link>.</span>
                  </label>
                  {errors.consent && <p id="e-consent" className="field-error">{errors.consent}</p>}
                </div>
                <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <button type="button" className="btn btn-ghost" onClick={() => go(3)}>Back</button>
                  <button type="submit" className="btn btn-primary btn-lg">Review booking</button>
                </div>
              </form>
            </section>
          )}

          {step === 5 && lesson && date && slot && (
            <section aria-labelledby="step-title">
              <StepHeading ref={headingRef} eyebrow="Step 5" title="Review and confirm." sub="Check everything looks right." />
              <div className="card mt-8 divide-y divide-line">
                <ReviewRow label="Lesson" value={`${lesson.name} · ${formatDuration(lesson.duration_minutes)}`} onEdit={() => go(1)} />
                <ReviewRow label="Date" value={longDate(date)} onEdit={() => go(2)} />
                <ReviewRow label="Time" value={`${slot.label} – ${slot.endLabel}`} onEdit={() => go(3)} />
                <ReviewRow label="Price" value={`${formatMoney(lesson.price_pence, currency)}${payingOnline ? "" : " · pay at lesson"}`} />
                <ReviewRow
                  label="Your details"
                  value={<>{details.fullName}<br /><span className="font-normal text-muted">{details.email} · {details.phone}<br />{experienceLabel(details.experience)}</span>{details.message && <><br /><span className="font-normal text-muted">“{details.message}”</span></>}</>}
                  onEdit={() => go(4)}
                />
              </div>
              <div className="mt-6 rounded-2xl bg-mist px-5 py-4 text-[14px] leading-relaxed text-ink-2">
                {props.requireApproval
                  ? "Your time is reserved as soon as you confirm. The instructor will review your request and you’ll get an email when it’s confirmed. "
                  : "Your lesson is confirmed as soon as you book. "}
                {payingOnline
                  ? props.requireApproval
                    ? `You’ll be taken to a secure payment page. Your card is authorised for ${formatMoney(due, currency)} but only charged once the lesson is confirmed.`
                    : `You’ll be taken to a secure payment page to pay ${formatMoney(due, currency)}.`
                  : ""}
                {` Free cancellation up to ${props.cancellationHours} hours before.`}
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" className="btn btn-ghost" onClick={() => go(4)} disabled={submitting}>Back</button>
                <button type="button" className="btn btn-primary btn-lg min-w-[220px]" onClick={submit} disabled={submitting} aria-busy={submitting}>
                  {submitting ? <><span className="spinner" aria-hidden="true" /> Booking…</> : payingOnline ? `Continue to payment` : props.requireApproval ? "Request booking" : "Confirm booking"}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Booking summary">
        <div className="card p-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Your booking</h2>
          <dl className="mt-5 space-y-4 text-[15px]">
            <SummaryRow icon="wheel-linear" label="Lesson" value={lesson ? lesson.name : "Not selected"} muted={!lesson} />
            <SummaryRow icon="calendar-linear" label="Date" value={date ? longDate(date) : "Not selected"} muted={!date} />
            <SummaryRow icon="clock-circle-linear" label="Time" value={slot ? `${slot.label} – ${slot.endLabel}` : lesson ? formatDuration(lesson.duration_minutes) : "—"} muted={!slot} />
          </dl>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
            <span className="text-muted">Total</span>
            <span className="font-display text-2xl font-bold tracking-[-0.02em]">{lesson ? formatMoney(lesson.price_pence, currency) : "—"}</span>
          </div>
          {lesson && payingOnline && due !== lesson.price_pence && (
            <p className="mt-1 text-right text-[13px] text-muted">{formatMoney(due, currency)} deposit online</p>
          )}
        </div>
        <p className="mt-4 flex items-center gap-2 px-2 text-[13px] text-muted"><Icon name="lock-keyhole-linear" size={16} /> Your details are only used to manage your lessons.</p>
      </aside>
    </div>
  );
}

const StepHeading = ({ ref, eyebrow, title, sub }: { ref: React.Ref<HTMLHeadingElement>; eyebrow: string; title: string; sub?: string }) => (
  <header>
    <p className="eyebrow">{eyebrow}</p>
    <h1 ref={ref} id="step-title" tabIndex={-1} className="mt-2 font-display text-[2.25rem] font-bold leading-tight tracking-[-0.03em] outline-none md:text-[2.75rem]">{title}</h1>
    {sub && <p className="mt-2 text-[1.0625rem] text-muted">{sub}</p>}
  </header>
);

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={`f-${id}`} className="field-label">{label}</label>
      {children}
      {error ? <p id={`e-${id}`} className="field-error" role="alert">{error}</p> : hint ? <p id={`h-${id}`} className="field-hint">{hint}</p> : null}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-6 px-6 py-5">
      <div className="min-w-0">
        <p className="text-[13px] text-muted">{label}</p>
        <p className="mt-1 font-semibold leading-relaxed">{value}</p>
      </div>
      {onEdit && <button type="button" className="shrink-0 text-[14px] font-semibold text-accent hover:underline" onClick={onEdit} aria-label={`Edit ${label.toLowerCase()}`}>Edit</button>}
    </div>
  );
}

function SummaryRow({ icon, label, value, muted }: { icon: "wheel-linear" | "calendar-linear" | "clock-circle-linear"; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-muted" />
      <div>
        <dt className="sr-only">{label}</dt>
        <dd className={muted ? "text-faint" : "font-medium"}>{value}</dd>
      </div>
    </div>
  );
}

function downloadIcs(ref: string, lesson: LessonType, startsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + lesson.duration_minutes * 60_000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//K444AXN Driving School//Booking//EN", "BEGIN:VEVENT",
    `UID:${ref}@k444axn`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:Driving lesson – ${lesson.name}`, `DESCRIPTION:Booking reference ${ref}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `driving-lesson-${ref}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
