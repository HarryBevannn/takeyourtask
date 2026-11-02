import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TakeYourTask",
  description: "A live task board for housekeeping and facilities teams.",
};

export const viewport: Viewport = {
  themeColor: "#070b1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="liquid-bg" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
        {children}
      </body>
    </html>
  );
}
