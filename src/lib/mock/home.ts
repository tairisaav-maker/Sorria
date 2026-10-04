import type { Clinic, Profile } from "@/types";

export const demoClinic: Clinic = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Clínica Demo Sorria",
  slug: "clinica-demo-sorria",
  timezone: "America/Sao_Paulo",
  phone: "(11) 3456-7890",
  email: "contato@clinicademo.sorria.app",
  address_line: "Rua das Flores, 120",
  city: "São Paulo",
  state: "SP",
  is_active: true,
  created_at: "2026-01-10T12:00:00.000Z",
  updated_at: "2026-01-10T12:00:00.000Z",
};

export const demoProfile: Profile = {
  id: "22222222-2222-2222-2222-222222222222",
  full_name: "Dra. Ana Ribeiro",
  email: "demo@sorria.app",
  phone: "(11) 98888-0000",
  avatar_url: null,
  created_at: "2026-01-10T12:00:00.000Z",
  updated_at: "2026-01-10T12:00:00.000Z",
};

export type HomeKpi = {
  id: string;
  label: string;
  value: string;
  hint: string;
};

export type HomeAppointment = {
  id: string;
  time: string;
  patientName: string;
  procedure: string;
  status: "confirmed" | "waiting" | "in_progress";
};

export type HomeRequest = {
  id: string;
  patientName: string;
  preferredWindow: string;
  createdLabel: string;
  status: "pending" | "proposed";
};

export type HomeWeekPoint = {
  day: string;
  appointments: number;
};

export const homeKpis: HomeKpi[] = [
  {
    id: "today",
    label: "Consultas hoje",
    value: "5",
    hint: "2 já confirmadas",
  },
  {
    id: "requests",
    label: "Solicitações",
    value: "3",
    hint: "aguardando resposta",
  },
  {
    id: "receivables",
    label: "A receber",
    value: "R$ 1.240",
    hint: "próximos 7 dias",
  },
  {
    id: "patients",
    label: "Pacientes ativos",
    value: "10",
    hint: "ambiente demo",
  },
];

export const homeAppointments: HomeAppointment[] = [
  {
    id: "a1",
    time: "09:00",
    patientName: "Marina Costa",
    procedure: "Limpeza",
    status: "confirmed",
  },
  {
    id: "a2",
    time: "10:30",
    patientName: "Pedro Almeida",
    procedure: "Avaliação",
    status: "waiting",
  },
  {
    id: "a3",
    time: "14:00",
    patientName: "Juliana Mendes",
    procedure: "Restauração",
    status: "confirmed",
  },
  {
    id: "a4",
    time: "16:00",
    patientName: "Rafael Souza",
    procedure: "Retorno",
    status: "in_progress",
  },
];

export const homeRequests: HomeRequest[] = [
  {
    id: "r1",
    patientName: "Camila Ferreira",
    preferredWindow: "Terça de manhã",
    createdLabel: "há 2 h",
    status: "pending",
  },
  {
    id: "r2",
    patientName: "Bruno Martins",
    preferredWindow: "Quinta à tarde",
    createdLabel: "ontem",
    status: "pending",
  },
  {
    id: "r3",
    patientName: "Helena Dias",
    preferredWindow: "Sábado",
    createdLabel: "há 3 dias",
    status: "proposed",
  },
];

export const homeWeekSeries: HomeWeekPoint[] = [
  { day: "Seg", appointments: 4 },
  { day: "Ter", appointments: 6 },
  { day: "Qua", appointments: 3 },
  { day: "Qui", appointments: 5 },
  { day: "Sex", appointments: 7 },
  { day: "Sáb", appointments: 2 },
];
