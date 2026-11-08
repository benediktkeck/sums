/**
 * The app mark: a pot with a plus above it, things being added up. White strokes
 * on a warm orange tile, drawn in a 24×24 box. Used by the logo, the PWA/Apple
 * icons and (copied by hand) `src/app/icon.svg`.
 */
export const BRAND_COLOR = "#ff6b35";
/** The tile: a diagonal gradient from warm amber (top left) through the brand orange. */
export const BRAND_TILE = `linear-gradient(135deg, #ff9140, ${BRAND_COLOR} 50%, #d95b2d)`;
/** Share of the tile's width the 24×24 mark box takes. */
export const MARK_SCALE = 0.74;
export const MARK_STROKE = 2.6;
export const MARK_PATHS = [
  "M12 1.6v5.6M9.2 4.4h5.6", // plus
  "M4 11.4h16l-1.6 8.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z", // pot
  "M3 11.4h18", // rim
] as const;
