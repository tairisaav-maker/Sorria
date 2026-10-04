export const ANAMNESIS_TEMPLATE_VERSION = 1;

export type AnamnesisQuestion = {
  key: string;
  label: string;
  type: "bool" | "text";
  showIf?: { key: string; equals: boolean };
  alertIfTrue?: { severity: "high" | "medium"; label: string };
};

export type AnamnesisSection = {
  id: string;
  title: string;
  questions: AnamnesisQuestion[];
};

export const ANAMNESIS_SECTIONS: AnamnesisSection[] = [
  {
    id: "geral",
    title: "Saúde geral",
    questions: [
      { key: "has_condition", label: "Possui alguma doença ou condição de saúde?", type: "bool" },
      {
        key: "condition_detail",
        label: "Qual condição?",
        type: "text",
        showIf: { key: "has_condition", equals: true },
        alertIfTrue: { severity: "medium", label: "Condição sistêmica" },
      },
      { key: "medical_followup", label: "Faz acompanhamento médico?", type: "bool" },
      { key: "had_surgery", label: "Já realizou cirurgia?", type: "bool" },
      { key: "was_hospitalized", label: "Já foi internado?", type: "bool" },
    ],
  },
  {
    id: "medicamentos",
    title: "Medicamentos",
    questions: [
      { key: "uses_medication", label: "Usa algum medicamento atualmente?", type: "bool" },
      {
        key: "medication_list",
        label: "Quais medicamentos?",
        type: "text",
        showIf: { key: "uses_medication", equals: true },
        alertIfTrue: { severity: "medium", label: "Medicamentos em uso" },
      },
    ],
  },
  {
    id: "alergias",
    title: "Alergias",
    questions: [
      { key: "has_allergy", label: "Possui alguma alergia?", type: "bool" },
      {
        key: "allergy_detail",
        label: "Qual alergia?",
        type: "text",
        showIf: { key: "has_allergy", equals: true },
        alertIfTrue: { severity: "high", label: "Alergia registrada" },
      },
    ],
  },
  {
    id: "cardio",
    title: "Cardiovascular",
    questions: [
      {
        key: "has_hypertension",
        label: "Possui hipertensão?",
        type: "bool",
        alertIfTrue: { severity: "medium", label: "Hipertensão" },
      },
      {
        key: "has_heart_disease",
        label: "Possui doença cardíaca?",
        type: "bool",
        alertIfTrue: { severity: "high", label: "Doença cardíaca" },
      },
      {
        key: "had_cardio_issue",
        label: "Já teve problema cardiovascular relevante?",
        type: "bool",
        alertIfTrue: { severity: "high", label: "Histórico cardiovascular" },
      },
    ],
  },
  {
    id: "metabolico",
    title: "Metabólico",
    questions: [
      {
        key: "has_diabetes",
        label: "Possui diabetes?",
        type: "bool",
        alertIfTrue: { severity: "high", label: "Diabetes" },
      },
    ],
  },
  {
    id: "sangramento",
    title: "Sangramento",
    questions: [
      {
        key: "coagulation_issue",
        label: "Possui alteração de coagulação?",
        type: "bool",
        alertIfTrue: { severity: "high", label: "Alteração de coagulação" },
      },
      {
        key: "uses_anticoagulant",
        label: "Usa anticoagulante?",
        type: "bool",
        alertIfTrue: { severity: "high", label: "Uso de anticoagulante" },
      },
    ],
  },
  {
    id: "gestacao",
    title: "Gestação",
    questions: [
      {
        key: "is_pregnant",
        label: "Está grávida?",
        type: "bool",
        alertIfTrue: { severity: "high", label: "Gravidez" },
      },
      {
        key: "possible_pregnancy",
        label: "Existe possibilidade de gestação?",
        type: "bool",
        alertIfTrue: { severity: "medium", label: "Possível gestação" },
      },
    ],
  },
  {
    id: "habitos",
    title: "Hábitos",
    questions: [
      { key: "smokes", label: "Fuma?", type: "bool" },
      { key: "drinks_alcohol", label: "Consome álcool?", type: "bool" },
    ],
  },
  {
    id: "odontologico",
    title: "Odontológico",
    questions: [
      {
        key: "anesthesia_reaction",
        label: "Já teve reação a anestesia?",
        type: "bool",
        alertIfTrue: { severity: "high", label: "Reação a anestesia" },
      },
      {
        key: "dental_bleeding",
        label: "Já apresentou sangramento excessivo em procedimento odontológico?",
        type: "bool",
        alertIfTrue: { severity: "high", label: "Sangramento odontológico prévio" },
      },
      {
        key: "prior_dental_info",
        label: "Possui alguma informação importante sobre tratamentos odontológicos anteriores?",
        type: "text",
      },
    ],
  },
  {
    id: "outros",
    title: "Outros",
    questions: [
      {
        key: "other_health_info",
        label: "Existe alguma informação de saúde que considera importante informar?",
        type: "text",
      },
    ],
  },
];

export function allQuestionKeys() {
  return ANAMNESIS_SECTIONS.flatMap((s) => s.questions.map((q) => q.key));
}
