import Link from "next/link";
import { BRAND_TILE, MARK_PATHS, MARK_SCALE, MARK_STROKE } from "@sums/core/brand-mark";

const TILE = 26;
const MARK = Math.round(TILE * MARK_SCALE);

/**
 * The app mark plus the installation's name. In the app it leads to the overview,
 * on the landing page to its top. Without a name (static loading shells, before
 * the runtime config is known) only the mark shows, so no wrong name flashes up.
 */
export function Logo({ name, href = "/uebersicht", label }: { name?: string; href?: string; label?: string }) {
  return (
    <Link href={href} className="logo" aria-label={label ?? (name ? `${name} – Übersicht` : "Übersicht")}>
      <i style={{ backgroundImage: BRAND_TILE }}>
        <svg width={MARK} height={MARK} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {MARK_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </i>
      {name}
    </Link>
  );
}
