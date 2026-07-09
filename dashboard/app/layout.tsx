import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WienerLog · Control plane",
  description: "Activity-aware task synthesis for Wiener Labs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
