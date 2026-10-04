/** Remove tudo que não for dígito. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeCpf(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  return digits.length > 0 ? digits : null;
}

export function normalizePhone(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  return digits.length > 0 ? digits : null;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatCpf(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  if (digits.length !== 11) return value?.trim() || "";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatPhoneBR(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return value?.trim() || "";
}

/** Validação clássica de dígitos verificadores do CPF. */
export function isValidCpf(value: string | null | undefined): boolean {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  const calc = (base: string, factor: number) => {
    let total = 0;
    for (let i = 0; i < base.length; i += 1) {
      total += Number(base[i]) * (factor - i);
    }
    const mod = (total * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

export function isReasonablePhone(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  const digits = digitsOnly(value);
  return digits.length >= 10 && digits.length <= 13;
}
