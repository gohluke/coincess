import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { AppShell } from "@/components/AppShell"
import "./globals.css"

const siteUrl = "https://coincess.com"

export const metadata: Metadata = {
  title: {
    default: "Coincess - Trade Perps, Predict & Automate",
    template: "%s | Coincess",
  },
  description: "Trade perpetuals on Hyperliquid, bet on prediction markets, and automate your strategies — all in one app.",
  keywords: [
    "cryptocurrency",
    "perpetuals",
    "hyperliquid",
    "polymarket",
    "prediction markets",
    "crypto trading",
    "defi",
    "automation",
  ],
  authors: [{ name: "Coincess" }],
  creator: "Coincess",
  publisher: "Coincess",

  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/assets/coincess-icon.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.png",
    apple: "/assets/coincess-icon.png",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Coincess",
    title: "Coincess - Trade Perps, Predict & Automate",
    description: "Trade perpetuals on Hyperliquid, bet on prediction markets, and automate your strategies — all in one app.",
    images: [
      {
        url: `${siteUrl}/assets/coincess-logo.png`,
        width: 1200,
        height: 630,
        alt: "Coincess",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Coincess - Trade Perps, Predict & Automate",
    description: "Hyperliquid perps + Polymarket predictions + automation in one app.",
    images: [`${siteUrl}/assets/coincess-logo.png`],
    creator: "@coincess",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  category: "Finance",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0e11",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Coincess" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Coincess",
              url: siteUrl,
              logo: `${siteUrl}/assets/coincess-logo.png`,
              description: "Trade perpetuals, predictions, and automate crypto strategies.",
            }),
          }}
        />
      </head>
      <body className="antialiased bg-[#0b0e11]">
        <Script
          src="https://phi.llc/tracker.js"
          data-id="phi_e43ce3b8844"
          strategy="afterInteractive"
        />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }
        `}</Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
