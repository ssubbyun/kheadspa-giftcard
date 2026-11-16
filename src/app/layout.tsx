import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Gift Cards | K-headspa & wellness",
  description:
    "Gift a restorative Korean head spa ritual in Manhattan, Norwood, and Fort Lee. Enjoy limited-time holiday promotion with 2-year validity. Powered by Stripe.",
  applicationName: "K-headspa & wellness",
  openGraph: {
    title: "Digital Gift Cards | K-headspa & wellness",
    description: "20% OFF Holiday Gift Cards with 2-Year Validity across all locations.",
    siteName: "K-headspa & wellness",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
