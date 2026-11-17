import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Gift Cards | K-headspa & wellness",
  description:
    "Gift a restorative Korean head spa ritual in Manhattan, Norwood, and Fort Lee. Enjoy limited-time holiday promotion with no expiration date. Powered by Stripe.",
  applicationName: "K-headspa & wellness",
  openGraph: {
    title: "Digital Gift Cards | K-headspa & wellness",
    description: "20% OFF Holiday Gift Cards — Never Expires across all locations.",
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
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#fff8f5] text-[#201b16] antialiased selection:bg-[#ffdea5] selection:text-[#061910]">
        {children}
      </body>
    </html>
  );
}
