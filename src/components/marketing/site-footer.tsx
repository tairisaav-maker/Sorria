import Link from "next/link";
import { getCommercialContact } from "@/lib/commercial/config";

export function SiteFooter() {
  const contact = getCommercialContact();

  return (
    <footer className="mt-20 border-t border-[var(--border)] pt-8 pb-10 text-sm text-[var(--text-muted)]">
      <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--brand-ink)]">
            Sorria
          </p>
          <p className="mt-1 text-[var(--text-subtle)]">
            Gestão inteligente para consultórios
          </p>
          <p className="mt-3">
            <a
              href={`mailto:${contact.email}`}
              className="text-[var(--brand-primary)] underline-offset-2 hover:underline"
            >
              {contact.email}
            </a>
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-x-5 gap-y-2"
          aria-label="Rodapé"
        >
          <Link href="/como-funciona" className="hover:underline">
            Como funciona
          </Link>
          <Link href="/planos" className="hover:underline">
            Planos
          </Link>
          <Link href="/conhecer" className="hover:underline">
            Contato
          </Link>
          <Link href="/privacidade" className="hover:underline">
            Privacidade
          </Link>
          <Link href="/termos" className="hover:underline">
            Termos
          </Link>
          <Link href="/login" className="hover:underline">
            Entrar
          </Link>
        </nav>
      </div>
      <p className="mt-8 text-xs text-[var(--text-subtle)]">
        O Sorria ajuda a entender custos e resultados operacionais. Não substitui
        contabilidade oficial nem recomenda condutas clínicas.
      </p>
    </footer>
  );
}
