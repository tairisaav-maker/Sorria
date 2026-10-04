export type FinancialTransactionType = "income" | "expense";

export type FinancialStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export type PaymentMethod =
  | "pix"
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "other";

export type ExpenseCategory =
  | "material"
  | "laboratorio"
  | "aluguel"
  | "condominio"
  | "energia"
  | "agua"
  | "internet"
  | "telefone"
  | "pessoas"
  | "pro_labore"
  | "software"
  | "contador"
  | "limpeza"
  | "seguranca"
  | "equipamentos"
  | "servicos"
  | "marketing"
  | "manutencao"
  | "impostos"
  | "outros";

export type CostBehavior = "fixed" | "variable";
export type RecurrenceType = "recurring" | "one_time";

export type FinancialTransaction = {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  treatment_plan_id: string | null;
  appointment_id: string | null;
  type: FinancialTransactionType;
  description: string;
  category: ExpenseCategory | null;
  /** Custeio: fixa × variável (despesas). */
  cost_behavior: CostBehavior | null;
  /** Custeio: recorrente × eventual. */
  recurrence_type: RecurrenceType | null;
  /** Se entra no cálculo de custo/hora. */
  allocation_eligible: boolean | null;
  /** Mês de competência YYYY-MM (custeio operacional). */
  reference_month: string | null;
  /** Data de competência (opcional). */
  competence_date: string | null;
  gross_amount_cents: number;
  discount_amount_cents: number;
  net_amount_cents: number;
  /** Status derivado persistido para consulta; recalculado no servidor. */
  status: FinancialStatus;
  due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
};

export type PaymentInstallment = {
  id: string;
  clinic_id: string;
  financial_transaction_id: string;
  installment_number: number;
  amount_cents: number;
  due_date: string;
  status: FinancialStatus;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  clinic_id: string;
  financial_transaction_id: string;
  payment_installment_id: string | null;
  amount_cents: number;
  paid_at: string;
  payment_method: PaymentMethod;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  client_request_id: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
};

export type InstallmentWithBalance = PaymentInstallment & {
  paid_cents: number;
  balance_cents: number;
  payments: Payment[];
};

export type TransactionWithDetails = FinancialTransaction & {
  installments: InstallmentWithBalance[];
  paid_cents: number;
  balance_cents: number;
  patient_name?: string | null;
  treatment_title?: string | null;
};

export type FinancialDashboard = {
  received_cents: number;
  receivable_cents: number;
  overdue_cents: number;
  expenses_cents: number;
  series: Array<{ month: string; income: number; expense: number }>;
  upcoming: Array<{
    id: string;
    due_date: string;
    amount_cents: number;
    balance_cents: number;
    description: string;
    patient_name: string | null;
    status: FinancialStatus;
  }>;
};

export type PatientFinancialSummary = {
  contracted_cents: number;
  received_cents: number;
  receivable_cents: number;
  overdue_cents: number;
};

export const TYPE_LABELS: Record<FinancialTransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
};

export const STATUS_LABELS: Record<FinancialStatus, string> = {
  pending: "Pendente",
  partially_paid: "Parcialmente pago",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
  bank_transfer: "Transferência",
  other: "Outro",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  material: "Material",
  laboratorio: "Laboratório",
  aluguel: "Aluguel",
  condominio: "Condomínio",
  energia: "Energia",
  agua: "Água",
  internet: "Internet",
  telefone: "Telefone",
  pessoas: "Pessoas / equipe",
  pro_labore: "Pró-labore",
  software: "Software",
  contador: "Contador",
  limpeza: "Limpeza",
  seguranca: "Segurança",
  equipamentos: "Equipamentos",
  servicos: "Serviços",
  marketing: "Marketing",
  manutencao: "Manutenção",
  impostos: "Impostos",
  outros: "Outros",
};
