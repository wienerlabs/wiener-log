import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, MobileTopBar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "WienerLog · Control plane",
  description: "Activity-aware task synthesis for Wiener Labs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Sidebar />
        <MobileTopBar />
        <main className="lg:pl-[248px]">
          <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
