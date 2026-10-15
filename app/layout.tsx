import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { connection } from "next/server";
import { Glow } from "@/components/Glow";
import "./globals.css";

// Self-hosted by next/font, so the CSP's font-src 'self' covers it.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const MARKETING_TITLE = "Unfill — speak with fewer filler words";
const DESCRIPTION =
  "Unfill gives you a random topic, a timer and honest feedback. Speak for a minute a day and watch your filler words fall.";

export const metadata: Metadata = {
  metadataBase: new URL("https://unfill.vercel.app"),
  // App pages stay "Unfill"; the signed-out landing sets an absolute title in app/page.tsx.
  title: { default: "Unfill", template: "%s · Unfill" },
  description: DESCRIPTION,
  applicationName: "Unfill",
  openGraph: {
    type: "website",
    siteName: "Unfill",
    title: MARKETING_TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: MARKETING_TITLE,
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: "Unfill",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request so the proxy's CSP nonce is applied to scripts.
  await connection();

  return (
    <html lang="en" className={manrope.variable}>
      <body className="relative min-h-dvh overflow-x-hidden bg-white text-ink">
        <Glow />
        <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]">
          {children}
        </main>
      </body>
    </html>
  );
}
