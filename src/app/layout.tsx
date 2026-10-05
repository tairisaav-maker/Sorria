import type { Metadata, Viewport } from "next";
import { Sora, Source_Sans_3 } from "next/font/google";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";

const display = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const appUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Sorria | Gestão inteligente para consultórios",
    template: "%s · Sorria",
  },
  description:
    "Gestão inteligente para consultórios. Agenda, estoque, materiais e financeiro conectados — saiba quanto cada procedimento realmente custa.",
  applicationName: "Sorria",
  appleWebApp: {
    capable: true,
    title: "Sorria",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/icons/favicon-32.png"],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Sorria | Gestão inteligente para consultórios",
    description:
      "O Sorria conecta cada procedimento aos materiais, estoque, custo e financeiro do consultório.",
    locale: "pt_BR",
    type: "website",
    siteName: "Sorria",
    url: appUrl,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#246B73" },
    { media: "(prefers-color-scheme: dark)", color: "#246B73" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
