import type { LessonType, Settings } from "@/lib/types";
import { siteUrl } from "@/lib/site";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** LocalBusiness data built only from details the instructor has entered. Nothing is guessed. */
export function businessJsonLd(s: Settings, lessons: LessonType[]) {
  const url = siteUrl();
  const address = s.locality || s.postcode || s.address_line
    ? { "@type": "PostalAddress", streetAddress: s.address_line || undefined, addressLocality: s.locality || undefined, postalCode: s.postcode || undefined }
    : undefined;
  const areas = s.service_areas?.split(/[,\n]/).map((a) => a.trim()).filter(Boolean);
  const sameAs = [s.instagram_url, s.facebook_url, s.tiktok_url].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": ["DrivingSchool", "LocalBusiness"],
    "@id": `${url}/#business`,
    name: s.business_name,
    url,
    telephone: s.phone || undefined,
    email: s.email || undefined,
    address,
    areaServed: areas?.length ? areas.map((name) => ({ "@type": "Place", name })) : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    founder: s.instructor_name ? { "@type": "Person", name: s.instructor_name, jobTitle: "Driving Instructor" } : undefined,
    makesOffer: lessons.length
      ? lessons.map((l) => ({
          "@type": "Offer",
          name: l.name,
          price: (l.price_pence / 100).toFixed(2),
          priceCurrency: s.currency,
          url: `${url}/book?lesson=${l.slug}`,
          itemOffered: { "@type": "Service", name: l.name, description: l.description || undefined },
        }))
      : undefined,
  };
}
