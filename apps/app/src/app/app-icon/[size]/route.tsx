import { ImageResponse } from "next/og";
import { BrandIcon } from "@/lib/brand-icon";

/**
 * PNG app icons for the web manifest.
 *
 * - `/app-icon/192`, `/app-icon/512` ("any"): the rounded tile, as on desktops.
 * - `/app-icon/maskable-192`, `/app-icon/maskable-512`: a full square the
 *   launcher cuts into its own shape; the mark stays inside the central safe zone.
 */
const ICONS: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-192": { size: 192, maskable: true },
  "maskable-512": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: RouteContext<"/app-icon/[size]">) {
  const icon = ICONS[(await ctx.params).size];
  if (!icon) return new Response("Not found", { status: 404 });
  const { size, maskable } = icon;
  return new ImageResponse(
    maskable ? <BrandIcon size={size} radius={0} markScale={0.6} /> : <BrandIcon size={size} radius={size * 0.22} />,
    { width: size, height: size },
  );
}
