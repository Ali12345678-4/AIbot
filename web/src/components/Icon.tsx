import { ICONS, type IconName } from "./icon-data";

export function Icon({ name, size = 20, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  const i = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${i.w} ${i.h}`}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: i.body }}
    />
  );
}
export type { IconName };
