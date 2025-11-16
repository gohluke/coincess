import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "coincess - Success In Crypto",
  description: "Make the most out of your digital assets.",
  icons: {
    icon: "/assets/coincess-icon.png",
    apple: "/assets/coincess-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
