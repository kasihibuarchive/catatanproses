import type { Metadata, Viewport } from "next";
import { Geist_Mono, Zen_Kaku_Gothic_New, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const zenGothic = Zen_Kaku_Gothic_New({
  variable: "--font-zen-gothic",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const zenMincho = Zen_Old_Mincho({
  variable: "--font-zen-mincho",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#f6f2e7",
};

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "稽古日誌 — Log Latihan Teater",
  description:
    "Catat latihan teater hari ini — durasi, catatan, dan foto. Tampil rapi per pekan dan per bulan.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "稽古日誌",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "稽古日誌 — Log Latihan Teater",
    description:
      "Catat latihan teater hari ini — durasi, catatan, dan foto. Tampil rapi per pekan dan per bulan.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "稽古日誌 — Log Latihan Teater" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "稽古日誌 — Log Latihan Teater",
    description:
      "Catat latihan teater hari ini — durasi, catatan, dan foto. Tampil rapi per pekan dan per bulan.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${zenGothic.variable} ${zenMincho.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
