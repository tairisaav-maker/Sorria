import type { Metadata } from "next";
import { LandingView } from "@/components/marketing/landing-view";

export const metadata: Metadata = {
  title: "Sorria | Gestão inteligente para consultórios odontológicos",
  description:
    "Saiba quanto cada procedimento realmente custa. O Sorria conecta procedimentos, materiais, estoque, custos e financeiro do consultório.",
  openGraph: {
    title: "Sorria | Gestão inteligente para consultórios odontológicos",
    description:
      "Agenda, pacientes, estoque, materiais e financeiro conectados — para o dentista entender o custo real de cada procedimento.",
    type: "website",
    locale: "pt_BR",
    siteName: "Sorria",
  },
  twitter: {
    card: "summary",
    title: "Sorria | Gestão inteligente para consultórios",
    description:
      "Saiba quanto cada procedimento realmente custa.",
  },
};

export default function LandingPage() {
  return <LandingView />;
}
