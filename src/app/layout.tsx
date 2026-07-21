import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Space_Grotesk, Figtree } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/nav/bottom-nav";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { cn } from "@/lib/utils";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpineCoach AI",
  description: "Adaptive bodyweight coach for adults with scoliosis.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SpineCoach",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#121814",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={cn("h-full", "antialiased", geistMono.variable, inter.variable, spaceGrotesk.variable, "font-sans", figtree.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <InstallPrompt />
        <div
          className="mx-auto flex w-full max-w-md flex-1 flex-col"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
          }}
        >
          <main className="flex-1 pb-4">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
