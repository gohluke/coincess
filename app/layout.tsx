import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Plus_Jakarta_Sans } from "next/font/google"
import { AppShell } from "@/components/AppShell"
import { BRAND_CONFIG } from "@/lib/brand.config"
import "./globals.css"

const brandFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-brand",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

const B = BRAND_CONFIG

export const metadata: Metadata = {
  title: {
    default: `${B.name} - ${B.tagline}`,
    template: `%s | ${B.name}`,
  },
  description: B.description,
  keywords: [...B.keywords],
  authors: [{ name: B.name }],
  creator: B.name,
  publisher: B.name,

  icons: {
    icon: [
      { url: B.assets.faviconIco, type: "image/x-icon", sizes: "48x48" },
      { url: B.assets.favicon, type: "image/png", sizes: "48x48" },
      { url: B.assets.icon, type: "image/png", sizes: "192x192" },
    ],
    shortcut: B.assets.faviconIco,
    apple: B.assets.appleTouchIcon,
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: B.url,
    siteName: B.name,
    title: `${B.name} - ${B.tagline}`,
    description: B.description,
    images: [
      {
        url: `${B.url}${B.assets.og}`,
        width: 1200,
        height: 630,
        alt: `${B.name} - ${B.tagline}`,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: `${B.name} - ${B.tagline}`,
    description: "Hyperliquid perps + Polymarket predictions + automation in one app.",
    images: [`${B.url}${B.assets.og}`],
    creator: B.twitter,
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

  metadataBase: new URL(B.url),
  alternates: { canonical: "/" },
  category: B.category,
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: B.pwa.backgroundColor,
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
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={B.name} />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: B.name,
                url: B.url,
                logo: `${B.url}${B.assets.icon}`,
                description: B.description,
                sameAs: ["https://x.com/coincess"],
              },
              {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: B.name,
                url: B.url,
                applicationCategory: "FinanceApplication",
                operatingSystem: "Web",
                description: B.description,
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                },
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: "4.8",
                  ratingCount: "50",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: B.name,
                url: B.url,
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${B.url}/trade/{search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              },
            ]),
          }}
        />
      </head>
        <body className={`${brandFont.variable} antialiased bg-[#0b0e11]`}>
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
