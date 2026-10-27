
export interface Student {
  id: string;
  nome: string;
  curso?: string;
  valor: number;
  dataVencimento: string;
  diasAtraso: number;
  followUp: string; // Mantido para compatibilidade, mas será deprecated
  email?: string;
  telefone?: string;
  observacoes: string;
  status: Status;
  statusHistory?: StatusHistory[];
  primeiroContato?: string;
  ultimoContato?: string;
  dataPagamento?: string;
  mes: string;
  createdBy?: string; // Novo campo para controlar quem criou o aluno
  followUps?: FollowUp[]; // Nova estrutura para follow-ups com histórico
}

export type Status = "inadimplente" | "mensagem-enviada" | "resposta-recebida" | "pagamento-feito" | "rescisao-trancamento";

export interface StatusHistory {
  oldStatus: Status;
  newStatus: Status;
  changedBy: string;
  changedAt: Date;
}

// Nova interface para follow-ups com histórico
export interface FollowUp {
  id: string;
  studentId: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SheetData {
  range: string;
  majorDimension: string;
  values: string[][];
}

export interface DashboardMetrics {
  total: number;
  ate5dias: number;
  ate10dias: number;
  mais10dias: number;
  pagamentoFeito: number;
}
