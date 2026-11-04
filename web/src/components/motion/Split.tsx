import { createElement, type ElementType } from "react";

/** Heading split into words for staggered reveal, with an unsplit accessible name. */
export function SplitHeading({ as = "h2", text, className, immediate = false, id }: { as?: ElementType; text: string; className?: string; immediate?: boolean; id?: string }) {
  const words = text.split(" ");
  return createElement(
    as,
    { className, "data-split": "", "data-split-immediate": immediate ? "" : undefined, id },
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <span key={i} className="split-word">
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </>,
  );
}

export function ScrubStatement({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <p className={className} data-scrub-words="">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <span key={i} className="scrub-word">{w}{i < words.length - 1 ? " " : ""}</span>
        ))}
      </span>
    </p>
  );
}
