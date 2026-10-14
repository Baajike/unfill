import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unfill",
  description: "Daily speaking practice without the filler words.",
  applicationName: "Unfill",
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
    <html lang="en">
      <body className="min-h-dvh bg-paper text-ink">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
          {children}
        </main>
      </body>
    </html>
  );
}
