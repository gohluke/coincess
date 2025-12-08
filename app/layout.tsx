import type { Metadata, Viewport } from "next"
import "./globals.css"

const siteUrl = "https://coincess.com"

export const metadata: Metadata = {
  // Basic metadata
  title: {
    default: "Coincess - Success In Crypto | Buy & Swap Cryptocurrency",
    template: "%s | Coincess",
  },
  description: "Your gateway to cryptocurrency success. Buy any coin instantly with no KYC, compare swap rates, calculate leverage trades, and learn crypto with expert guides.",
  keywords: [
    "cryptocurrency",
    "buy crypto",
    "swap crypto",
    "no kyc crypto",
    "bitcoin",
    "monero",
    "crypto exchange",
    "leverage calculator",
    "privacy coins",
    "crypto guide",
  ],
  authors: [{ name: "Coincess" }],
  creator: "Coincess",
  publisher: "Coincess",
  
  // Favicon and icons
  icons: {
    icon: "/assets/coincess-icon.png",
    shortcut: "/assets/coincess-icon.png",
    apple: "/assets/coincess-icon.png",
  },

  // Open Graph (Facebook, LinkedIn, etc.)
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Coincess",
    title: "Coincess - Success In Crypto | Buy & Swap Cryptocurrency",
    description: "Your gateway to cryptocurrency success. Buy any coin instantly with no KYC, compare swap rates, and learn crypto with expert guides.",
    images: [
      {
        url: `${siteUrl}/assets/coincess-logo.png`,
        width: 1200,
        height: 630,
        alt: "Coincess - Success In Crypto",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Coincess - Success In Crypto",
    description: "Buy any coin instantly with no KYC. Compare swap rates and learn crypto with expert guides.",
    images: [`${siteUrl}/assets/coincess-logo.png`],
    creator: "@coincess",
  },

  // Robots
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

  // Verification (add your actual verification codes when you have them)
  // verification: {
  //   google: "your-google-verification-code",
  //   yandex: "your-yandex-verification-code",
  // },

  // Canonical URL
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },

  // Category
  category: "Finance",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#7C3AED",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Coincess",
              url: siteUrl,
              logo: `${siteUrl}/assets/coincess-logo.png`,
              description: "Your gateway to cryptocurrency success. Buy, swap, and learn crypto.",
              sameAs: [
                // Add your social media URLs here
                // "https://twitter.com/coincess",
                // "https://github.com/coincess",
              ],
            }),
          }}
        />
        {/* Structured Data - WebSite (for sitelinks search box) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Coincess",
              url: siteUrl,
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${siteUrl}/coins?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
