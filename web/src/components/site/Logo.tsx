import Link from "next/link";

/** Number-plate wordmark: the school name is a UK-style registration. */
export function Plate({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[6px] px-[7px] py-[2px] font-display text-[13px] font-bold tracking-[0.06em] tabular-nums ${
        dark ? "bg-white text-black" : "bg-ink text-canvas"
      } ${className}`}
      aria-hidden="true"
    >
      K444&thinsp;AXN
    </span>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="K444AXN Driving School home">
      <Plate dark={dark} />
      <span className={`hidden whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] min-[400px]:inline ${dark ? "text-white" : "text-ink"}`}>Driving School</span>
    </Link>
  );
}
