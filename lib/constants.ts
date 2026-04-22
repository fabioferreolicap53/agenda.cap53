export const INVOLVEMENT_LEVELS = [
  { value: 'ORGANIZADOR', label: 'Organizador' },
  { value: 'PARTICIPANTE', label: 'Participante' }
];

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
  }
];

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
