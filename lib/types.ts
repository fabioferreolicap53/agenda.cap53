export interface AlmacRequest {
  id: string;
  quantity: number;
  status: string;
  item: string;
  event: string;
  created_by: string;
  justification?: string;
  expand?: {
    item?: {
      name: string;
      category?: string;
    };
    event?: {
      title: string;
    };
    created_by?: {
      id: string;
      name?: string;
      email?: string;
    };
  };
}

export interface EventRecord {
  id: string;
  title: string;
  transporte_status?: string;
  transporte_destino?: string;
  transporte_horario_levar?: string;
  transporte_horario_buscar?: string;
  transporte_qtd_pessoas?: number;
  transporte_passageiro?: number;
  transporte_justification?: string;
  transporte_obs?: string;
  user: string;
}
