const FAQ = [
  {
    q: "Preciso cadastrar todos os materiais de uma vez?",
    a: "Não. O cadastro pode ser progressivo — comece pelos procedimentos que você realiza com mais frequência.",
  },
  {
    q: "O Sorria calcula o custo dos procedimentos?",
    a: "Sim, de acordo com os materiais e as configurações cadastradas no consultório. É um custo operacional estimado, não um balanço contábil.",
  },
  {
    q: "Ele substitui meu contador?",
    a: "Não. O Sorria organiza a operação do consultório. Contabilidade e obrigações fiscais continuam com o seu contador.",
  },
  {
    q: "Consigo controlar estoque?",
    a: "Sim. O estoque conversa com a Agenda e com o consumo real dos procedimentos.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. A interface foi pensada para celular, tablet e desktop.",
  },
  {
    q: "Posso cadastrar minha equipe?",
    a: "Sim, conforme o plano da clínica e o limite de profissionais/usuários configurado.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20">
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
        Perguntas frequentes
      </h2>
      <dl className="mt-6 divide-y divide-[var(--border)]">
        {FAQ.map((item) => (
          <div key={item.q} className="py-4">
            <dt className="font-medium text-[var(--brand-ink)]">{item.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
