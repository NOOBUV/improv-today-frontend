import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/shared/AuthProvider";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport = "width=device-width, initial-scale=1";

export const metadata: Metadata = {
  title: "Clara - Your Digital Companion",
  description: "Talk with Clara, an AI companion whose life unfolds in real time.",
  authors: [{ name: "Clara Team" }],
  icons: {
    icon: "/clara-logo.png",
    shortcut: "/clara-logo.png",
    apple: "/clara-logo.png",
  },
  openGraph: {
    title: "Clara - Your Digital Companion",
    description: "Talk with Clara, an AI companion whose life unfolds in real time.",
    type: "website",
    locale: "en_US",
    images: ["/clara-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clara - Your Digital Companion",
    description: "Talk with Clara, an AI companion whose life unfolds in real time.",
    images: ["/clara-logo.png"],
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
        <ErrorBoundary>
          <AuthProvider>
            <AuthGuard>
              <main className="min-h-screen">
                {children}
              </main>
            </AuthGuard>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
