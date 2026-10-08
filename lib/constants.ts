export const INVOLVEMENT_LEVELS = [
  { value: 'ORGANIZADOR', label: 'Organizador', description: 'Responsável por organizar o evento.' },
  { value: 'PARTICIPANTE', label: 'Participante', description: 'Apenas participa do evento.' }
];

// Regra única do nível de envolvimento de quem cria o evento, definida
// automaticamente pela "Responsabilidade pela organização":
// - Ação interna / Evento coletivo -> Organizador (quem cria organiza)
// - Participação externa           -> Participante (quem cria só participa)
// - Não se aplica                  -> sem organização (campo não selecionável)
export const CREATOR_INVOLVEMENT_BY_RESPONSIBILITY: Record<string, string> = {
  INTERNO_COMPROMISSO: 'ORGANIZADOR',
  INTERNO_COLETIVO: 'ORGANIZADOR',
  EXTERNO_COMPROMISSO: 'PARTICIPANTE',
  NAO_SE_APLICA: 'ORGANIZADOR'
};

// Rótulo de um nível de envolvimento.
export const getInvolvementLabel = (value?: string): string => {
  if (!value) return '';
  return INVOLVEMENT_LEVELS.find(l => l.value === value.toUpperCase())?.label || value;
};

export const RESPONSIBILITY_LEVELS = [
  { 
    value: 'INTERNO_COMPROMISSO', 
    label: 'Ação interna',
    description: 'A coordenação organiza tudo, mas em um formato menor, voltado para uma pessoa ou um grupo específico.'
  },
  { 
    value: 'INTERNO_COLETIVO', 
    label: 'Evento coletivo',
    description: 'A coordenação organiza tudo, focado em receber um maior número de pessoas.'
  },
  { 
    value: 'EXTERNO_COMPROMISSO', 
    label: 'Participação externa',
    description: 'O evento é de terceiros. A coordenação apenas envia um ou mais representantes.'
  },
  {
    value: 'NAO_SE_APLICA',
    label: 'Não se aplica',
    description: 'Apenas lembretes específicos. Não exige organização de evento.'
  }
];

// Cores por nível de envolvimento — do mais escuro (maior responsabilidade) ao
// mais claro, reforçando a hierarquia de papéis na rampa institucional DAPS:
// azul corporativo do sistema (#1C2E4A) e variações profissionais derivadas.
export const DAPS_ROLE_COLORS = {
  ORGANIZADOR: {
    bar: 'bg-[#1C2E4A]',
    chip: 'bg-[#1C2E4A]/10 text-[#1C2E4A]',
    dot: 'bg-[#1C2E4A]',
    text: 'text-[#1C2E4A]',
    ring: 'border-[#1C2E4A]/35',
  },
  CO_ORGANIZADOR: {
    bar: 'bg-[#456086]',
    chip: 'bg-[#456086]/12 text-[#456086]',
    dot: 'bg-[#456086]',
    text: 'text-[#456086]',
    ring: 'border-[#456086]/35',
  },
  PARTICIPANTE: {
    bar: 'bg-[#7C97BB]',
    chip: 'bg-[#7C97BB]/20 text-[#456086]',
    dot: 'bg-[#7C97BB]',
    text: 'text-[#456086]',
    ring: 'border-[#7C97BB]/45',
  },
} as const;

// ─── Rótulos de presença ───────────────────────────────────────────────
// Vocabulário único usado em todo o sistema para informar se/como um usuário
// estará presente em um evento. Substitui termos genéricos ("Confirmado",
// "Removido", "Retirou-se") por rótulos que descrevem a origem da presença.
export const PRESENCE_LABELS = {
  /** Criador que organiza o evento. */
  CREATOR_ORGANIZER: 'Presença Confirmada',
  /** Criador que apenas participa (ex.: participação externa). */
  CREATOR_PARTICIPANT: 'Presença Declarada',
  /** Convidado pelo criador durante a criação/edição. */
  INVITED: 'Presença Solicitada',
  /** Entrou por conta própria pelo detalhamento do evento. */
  SELF_JOINED: 'Declara Estar Presente',
  /** Teve a participação retirada pelo criador. */
  REJECTED: 'Presença Recusada/Foi Retirado(a)',
  /** Retirou-se por conta própria (ou negou o convite). */
  WITHDRAWN: 'Nega Presença/Retirou-se',
  /** Ainda não houve decisão sobre a presença. */
  PENDING: 'Presença Pendente',
} as const;

export interface PresenceLabelInput {
  /** true quando a linha representa quem criou o evento. */
  isCreator?: boolean;
  /** Papel de quem criou (ORGANIZADOR | PARTICIPANTE) — só usado se isCreator. */
  creatorRole?: string;
  /** Status da participação (accepted | pending | rejected | withdrawn | declined). */
  status?: string;
  /** true quando o usuário entrou por conta própria (tem solicitação registrada). */
  hasOwnRequest?: boolean;
}

export const getPresenceLabel = ({
  isCreator,
  creatorRole,
  status,
  hasOwnRequest,
}: PresenceLabelInput): string => {
  if (isCreator) {
    return (creatorRole || '').toUpperCase() === 'PARTICIPANTE'
      ? PRESENCE_LABELS.CREATOR_PARTICIPANT
      : PRESENCE_LABELS.CREATOR_ORGANIZER;
  }
  const s = (status || 'pending').toLowerCase();
  if (s === 'rejected') return PRESENCE_LABELS.REJECTED;
  if (s === 'withdrawn' || s === 'declined') return PRESENCE_LABELS.WITHDRAWN;
  if (s === 'accepted') {
    return hasOwnRequest ? PRESENCE_LABELS.SELF_JOINED : PRESENCE_LABELS.INVITED;
  }
  return PRESENCE_LABELS.PENDING;
};

export const EVENT_TYPES_ORDER = [
  'EVENTO',
  'REUNIÃO',
  'TREINAMENTO',
  'OFICINA',
  'COMPROMISSO',
  'COLEGIADO',
  'REUNIÃO DE GESTORES',
  'REUNIÃO DE PLANEJAMENTO',
  'SEMINÁRIO',
  'PALESTRA'
];
