import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { appName } from "@/server/config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection();
  const name = appName();
  return {
    name: `${name} – Haushaltsplaner`,
    short_name: name,
    description: "Einkommen, Fixkosten, Rücklagen und was übrig bleibt.",
    lang: "de",
    id: "/",
    start_url: "/uebersicht",
    scope: "/",
    display: "standalone",
    background_color: "#0c0c0e",
    theme_color: "#0c0c0e",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/maskable-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/app-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
