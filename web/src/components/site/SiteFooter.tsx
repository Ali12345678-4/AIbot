import Link from "next/link";
import type { Settings } from "@/lib/types";
import { Plate } from "./Logo";
import { Icon } from "../Icon";

export function SiteFooter({ settings }: { settings: Settings }) {
  const socials = [
    settings.instagram_url && { href: settings.instagram_url, label: "Instagram", icon: "brand-instagram" as const },
    settings.facebook_url && { href: settings.facebook_url, label: "Facebook", icon: "brand-facebook" as const },
    settings.tiktok_url && { href: settings.tiktok_url, label: "TikTok", icon: "brand-tiktok" as const },
  ].filter(Boolean) as { href: string; label: string; icon: "brand-instagram" | "brand-facebook" | "brand-tiktok" }[];
  const place = [settings.locality, settings.postcode].filter(Boolean).join(", ");
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="border-t border-line bg-mist text-[13px] text-muted">
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Plate />
            <span className="text-[15px] font-semibold text-ink">Driving School</span>
          </div>
          <p className="mt-4 max-w-xs leading-relaxed">Patient, professional driving lessons, booked online in minutes.</p>
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-2" aria-label="Social media">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="grid size-10 place-items-center rounded-full bg-paper text-ink-2 shadow-[0_0_0_1px_rgba(0,0,0,.06)] transition hover:text-ink">
                    <Icon name={s.icon} size={17} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">Contact</h2>
          <ul className="space-y-3">
            {settings.phone && (
              <li><a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 hover:text-ink"><Icon name="phone-linear" size={16} />{settings.phone}</a></li>
            )}
            {settings.email && (
              <li><a href={`mailto:${settings.email}`} className="inline-flex items-center gap-2 break-all hover:text-ink"><Icon name="letter-linear" size={16} />{settings.email}</a></li>
            )}
            {place && <li className="inline-flex items-center gap-2"><Icon name="map-point-linear" size={16} />{place}</li>}
            {!settings.phone && !settings.email && <li>Contact details coming soon. You can still <Link href="/book" className="text-accent hover:underline">book online</Link>.</li>}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">Explore</h2>
          <ul className="space-y-3">
            <li><Link href="/#lessons" className="hover:text-ink">Lessons &amp; prices</Link></li>
            <li><Link href="/#about" className="hover:text-ink">About the instructor</Link></li>
            <li><Link href="/#reviews" className="hover:text-ink">Reviews</Link></li>
            <li><Link href="/book" className="hover:text-ink">Book a lesson</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">Legal</h2>
          <ul className="space-y-3">
            <li><Link href="/privacy" className="hover:text-ink">Privacy policy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms &amp; cancellations</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-x flex flex-col gap-2 border-t border-line-strong/60 py-6 md:flex-row md:items-center md:justify-between">
        <p>© {year} {settings.business_name}. All rights reserved.</p>
        {settings.service_areas && <p>Covering {settings.service_areas}.</p>}
      </div>
    </footer>
  );
}
