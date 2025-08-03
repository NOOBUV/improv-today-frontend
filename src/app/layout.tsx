import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport = "width=device-width, initial-scale=1";

export const metadata: Metadata = {
  title: "ImprovToday - AI Conversation Practice",
  description: "Practice English conversation with AI. Clean, minimal interface with personality selection.",
  keywords: "English learning, conversation practice, AI tutor, speaking skills",
  authors: [{ name: "ImprovToday Team" }],
  openGraph: {
    title: "ImprovToday - AI Conversation Practice",
    description: "Practice English conversation with AI",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ImprovToday - AI Conversation Practice",
    description: "Practice English conversation with AI",
  },
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
