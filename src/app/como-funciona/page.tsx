import type { Metadata } from "next";
import { HowItWorksView } from "@/components/marketing/how-it-works-view";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Agenda → Paciente → Procedimento → Materiais → Estoque → Custo → Financeiro. Veja como o Sorria conecta o consultório.",
  openGraph: {
    title: "Como funciona | Sorria",
    description:
      "Do agendamento ao recebimento: entenda o fluxo do Sorria.",
  },
};

export default function ComoFuncionaPage() {
  return <HowItWorksView />;
}
