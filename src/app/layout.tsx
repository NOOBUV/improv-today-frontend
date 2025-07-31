import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ImprovToday - Improve Your English Speaking Skills",
  description: "Practice conversational English with AI, track your progress with beautiful visualizations, and build confidence through daily vocabulary learning.",
  keywords: "English learning, conversation practice, AI tutor, vocabulary, speaking skills, language learning",
  authors: [{ name: "ImprovToday Team" }],
  openGraph: {
    title: "ImprovToday - Improve Your English Speaking Skills",
    description: "Practice conversational English with AI and track your progress",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ImprovToday - Improve Your English Speaking Skills",
    description: "Practice conversational English with AI and track your progress",
  },
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <Navigation />
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
