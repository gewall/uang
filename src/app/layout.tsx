import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_PALETTE, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "uang", template: "%s · uang" },
  description: "Catatan keuangan pribadi",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "uang", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // supaya env(safe-area-inset-*) berlaku di iPhone (bottom nav)
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-palette & class "dark" dikoreksi oleh THEME_INIT_SCRIPT sebelum paint
    <html
      lang="id"
      data-palette={DEFAULT_PALETTE}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
