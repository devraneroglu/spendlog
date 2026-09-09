import type { Metadata } from "next";
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
  title: {
    default: "SpendLog | Kurumsal Finans & Varlık Yönetimi",
    template: "%s | SpendLog",
  },
  description: "Yapay zekâ destekli kurumsal finans yönetimi, akıllı kredi kartı ekstre ayrıştırıcı, canlı portföy takibi ve Telegram bot entegrasyonu.",
  keywords: ["SpendLog", "Finans Takip", "Kredi Kartı Ekstre", "Portföy Yönetimi", "BIST", "Kripto", "Altın"],
  authors: [{ name: "SpendLog Team" }],
};

import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>
          <ToastProvider>{children}</ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
