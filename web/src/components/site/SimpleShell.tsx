import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { getSettings } from "@/server/settings";

export async function SimpleShell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  const settings = await getSettings();
  return (
    <>
      <SiteHeader />
      <main id="main" className={`container-x pb-24 pt-28 md:pt-36 ${narrow ? "max-w-3xl" : ""}`}>{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
