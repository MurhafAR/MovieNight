import type { Metadata } from "next";
import { Geist, Geist_Mono, Arizonia } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/i18n/I18nContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const arizonia = Arizonia({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-arizonia",
});
export const metadata: Metadata = {
  title: "MovieNight",
  description: "Watch Movies with your friends.",
  icons: "/favicon.ico",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SessionProvider>
      <html
        lang="en"
        className={`${arizonia.variable} ${geistSans.variable} ${geistMono.variable}`}
      >
        <body>
          <I18nProvider>{children}</I18nProvider>
        </body>
      </html>
    </SessionProvider>
  );
}
