import type { Metadata } from "next";
import { SimpleShell } from "@/components/site/SimpleShell";
import { getSettings } from "@/server/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default async function PrivacyPage() {
  const s = await getSettings();
  const contact = s.email ?? "the contact details on this website";
  return (
    <SimpleShell narrow>
      <article className="prose-k4">
        <p className="eyebrow">Legal</p>
        <h1 className="display-md mt-2">Privacy policy</h1>
        <p className="lede mt-4">How {s.business_name} collects and uses your personal information.</p>
        <h2>What we collect</h2>
        <p>When you book a lesson we collect your name, phone number, email address, your driving experience and anything you choose to tell us in the notes field. We also keep a record of your bookings.</p>
        <h2>Why we collect it</h2>
        <p>We use your information only to arrange and deliver your driving lessons: to confirm bookings, contact you about changes, and keep a record of your progress. Our legal basis is the performance of a contract with you, and our legitimate interest in running the business.</p>
        <h2>Who we share it with</h2>
        <p>We never sell your data. It is stored with our hosting and database providers, sent through our email provider so we can contact you, and, if you pay online, processed by our payment provider. These providers act on our instructions only.</p>
        <h2>How long we keep it</h2>
        <p>We keep booking records for as long as needed to provide lessons and meet our legal and accounting obligations, after which they are deleted.</p>
        <h2>Your rights</h2>
        <p>You can ask to see, correct or delete the personal information we hold about you, or object to how it is used, by contacting {contact}. You also have the right to complain to your data protection authority.</p>
        <h2>Cookies</h2>
        <p>This website does not use advertising or tracking cookies. A strictly necessary cookie is used only to keep the instructor signed in to the private dashboard.</p>
        <p className="text-sm text-muted">Last updated {new Date(s.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</p>
      </article>
    </SimpleShell>
  );
}
