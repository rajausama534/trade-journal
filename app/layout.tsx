import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";

export const metadata: Metadata = { title: "TradeFlow Journal", description: "A focused trading journal for prop traders" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
