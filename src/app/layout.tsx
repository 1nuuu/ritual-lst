import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { config, prefixedSymbol } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${config.protocolName} - Liquid Staking on ${config.chainName}`,
  description: `A Ritual-native liquid staking protocol. Stake ${
    config.tokenSymbol
  }, receive ${prefixedSymbol(config.lstSymbol)}, stay liquid.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
