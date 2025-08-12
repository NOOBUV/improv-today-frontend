import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Auth0Provider } from '@auth0/nextjs-auth0';

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
  icons: {
    icon: "/improv-today-logo.png",
    shortcut: "/improv-today-logo.png",
    apple: "/improv-today-logo.png",
  },
  openGraph: {
    title: "ImprovToday - AI Conversation Practice",
    description: "Practice English conversation with AI",
    type: "website",
    locale: "en_US",
    images: ["/improv-today-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ImprovToday - AI Conversation Practice",
    description: "Practice English conversation with AI",
    images: ["/improv-today-logo.png"],
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
        <Auth0Provider>
          <main className="min-h-screen">
            {children}
          </main>
        </Auth0Provider>
      </body>
    </html>
  );
}
