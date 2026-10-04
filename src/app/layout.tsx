import type { Metadata } from "next";
import { Sora, Source_Sans_3 } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Sorria | Gestão inteligente para consultórios odontológicos",
    template: "%s · Sorria",
  },
  description:
    "Saiba quanto cada procedimento realmente custa. Agenda, estoque, materiais e financeiro conectados.",
  applicationName: "Sorria",
  openGraph: {
    title: "Sorria | Gestão inteligente para consultórios odontológicos",
    description:
      "O Sorria conecta cada procedimento aos materiais, estoque, custo e financeiro do consultório.",
    locale: "pt_BR",
    type: "website",
    siteName: "Sorria",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
