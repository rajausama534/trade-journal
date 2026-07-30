import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./account-menu.css";

export const metadata: Metadata = {
  title: "TradeFlow Journal",
  description: "A focused trading journal for gold traders",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
