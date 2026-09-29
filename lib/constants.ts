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
