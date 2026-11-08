import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { analyticsConfig } from "@sums/core/analytics-config";
import { Analytics } from "@/components/analytics";
import { siteName } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { applicationName: siteName() };

export const viewport: Viewport = { themeColor: "#0c0c0e" };

/** Reads the analytics setting at request time, outside the prerendered page. */
async function AnalyticsLoader() {
  await connection();
  const config = analyticsConfig();
  return config ? <Analytics token={config.key} /> : null;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" data-theme="dark" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <Suspense fallback={null}>
          <AnalyticsLoader />
        </Suspense>
      </body>
    </html>
  );
}
