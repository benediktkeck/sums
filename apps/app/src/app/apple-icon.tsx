import { ImageResponse } from "next/og";
import { BrandIcon } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS rounds the corners itself, so fill the whole square.
  return new ImageResponse(<BrandIcon size={180} radius={0} />, size);
}
