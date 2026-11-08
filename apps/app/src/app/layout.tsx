import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { PwaSetup } from "@/components/pwa-setup";
import { AnalyticsLoader } from "@/components/analytics-loader";
import { appName } from "@/server/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** The name is runtime config (SUMS_APP_NAME), so metadata is resolved per request. Pages set only their own title. */
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const name = appName();
  return {
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" },
    title: { default: name, template: `%s · ${name}` },
    description: "Haushaltsplaner: Einkommen, Fixkosten, Rücklagen und was übrig bleibt – mit Was-wäre-wenn-Szenarien.",
  };
}

export const viewport: Viewport = {
  themeColor: "#0c0c0e",
  // Without "cover" the safe-area-inset-* values stay 0 in the installed app.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false} themes={["dark", "light"]}>
          {children}
          <Toaster position="bottom-center" mobileOffset={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }} />
          <PwaSetup />
          <Suspense fallback={null}>
            <AnalyticsLoader />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
