import { BRAND_TILE, MARK_PATHS, MARK_SCALE, MARK_STROKE } from "@sums/core/brand-mark";

/**
 * The app mark as plain JSX for ImageResponse (apple-icon, PWA icons).
 * `radius` rounds the tile (corners stay transparent); `markScale` shrinks the
 * mark, e.g. to keep it inside the safe zone of a maskable icon.
 */
export function BrandIcon({ size, radius, markScale = MARK_SCALE }: { size: number; radius: number; markScale?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundImage: BRAND_TILE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * markScale} height={size * markScale} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round">
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>
  );
}
