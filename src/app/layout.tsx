import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/nav/bottom-nav";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpineCoach AI",
  description: "Adaptive bodyweight coach for adults with scoliosis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <main className="flex-1 pb-4">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
