import React from 'react';

type TabId =
  | 'all'
  | 'lead'
  | 'created_participant'
  | 'others'
  | 'organizer'
  | 'participant'
  | 'withdrawn'
  | 'removed';

interface StatsProps {
  stats: {
    totalCreated: number;
    organizer: number;
    participant: number;
    invitesPending: number;
    requestsPending: number;
    invitesRejected: number;
    requestsRejected: number;
    invitesWithdrawn?: number;
    createdAsOrganizer?: number;
    createdAsParticipant?: number;
    participantInvited?: number;
    participantByRequest?: number;
  };
  activeTab: TabId | null;
  onTabChange: (tab: TabId) => void;
}

// Cores fixas por cartão (Tailwind precisa das classes literais para não perder o purge).
// Rampa institucional azul corporativo — mesma paleta de "Eventos DAPS".
const ACCENT: Record<string, { active: string; chip: string; bar: string; text: string; soft: string }> = {
  navy: {
    active: 'text-[#1C2E4A] bg-[#1C2E4A]/10 border-[#1C2E4A]/30',
    chip: 'bg-[#1C2E4A]/10 text-[#1C2E4A]',
    bar: 'bg-[#1C2E4A]',
    text: 'text-[#1C2E4A]',
    soft: 'bg-[#1C2E4A]/5 border-[#1C2E4A]/10'
  },
  steel: {
    active: 'text-[#456086] bg-[#456086]/10 border-[#456086]/30',
    chip: 'bg-[#456086]/10 text-[#456086]',
    bar: 'bg-[#456086]',
    text: 'text-[#456086]',
    soft: 'bg-[#456086]/5 border-[#456086]/10'
  },
  sky: {
    active: 'text-[#5B7DAA] bg-[#7C97BB]/15 border-[#7C97BB]/40',
    chip: 'bg-[#7C97BB]/20 text-[#456086]',
    bar: 'bg-[#7C97BB]',
    text: 'text-[#456086]',
    soft: 'bg-[#7C97BB]/10 border-[#7C97BB]/20'
  },
  amber: {
    active: 'text-amber-700 bg-amber-50 border-amber-300/70',
    chip: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    soft: 'bg-amber-50/80 border-amber-200/60'
  },
  mist: {
    active: 'text-[#5B7DAA] bg-[#9AB1D0]/20 border-[#9AB1D0]/50',
    chip: 'bg-[#9AB1D0]/25 text-[#456086]',
    bar: 'bg-[#9AB1D0]',
    text: 'text-[#5B7DAA]',
    soft: 'bg-[#9AB1D0]/15 border-[#9AB1D0]/25'
  },
  graphite: {
    active: 'text-[#475569] bg-[#475569]/10 border-[#475569]/30',
    chip: 'bg-[#475569]/10 text-[#475569]',
    bar: 'bg-[#475569]',
    text: 'text-[#475569]',
    soft: 'bg-[#475569]/5 border-[#475569]/10'
  },
};

// Cartões com profundidade: sombra colorida + elevação no hover para darem
// a sensação de estarem em primeiro plano sobre o fundo da página.
const CARD_DEPTH =
  'shadow-[0_10px_28px_-14px_rgba(28,46,74,0.28)] hover:shadow-[0_20px_44px_-16px_rgba(28,46,74,0.4)] hover:-translate-y-1';

/** Animações do "fluxo de derivação" entre cartão-pai e cartões-filho. */
const DerivationStyles: React.FC = () => (
  <style>{`
    @keyframes msFlowY {
      from { background-position: 0 0; }
      to { background-position: 0 10px; }
    }
    @keyframes msFlowX {
      from { background-position: 0 0; }
      to { background-position: 10px 0; }
    }
    .ms-flow-y {
      background-image: repeating-linear-gradient(to bottom, currentColor 0 4px, transparent 4px 10px);
      animation: msFlowY 0.9s linear infinite;
    }
    .ms-flow-x {
      background-image: repeating-linear-gradient(to right, currentColor 0 4px, transparent 4px 10px);
      animation: msFlowX 0.9s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .ms-flow-y, .ms-flow-x { animation: none; }
    }
  `}</style>
);

export const StatsCards: React.FC<StatsProps> = ({ stats, activeTab, onTabChange }) => {
  const withdrawn = stats.invitesWithdrawn || 0;
  const removed = stats.invitesRejected + stats.requestsRejected;

  const createdAsOrganizer = stats.createdAsOrganizer || 0;
  const createdAsParticipant = stats.createdAsParticipant || 0;
  const createdActive = createdAsOrganizer + createdAsParticipant;

  const orgOther = stats.organizer;
  const partOther = stats.participant;
  const othersActive = orgOther + partOther;

  const participantInvited = stats.participantInvited || 0;
  const participantByRequest = stats.participantByRequest || 0;
  const participantTotal = participantInvited + participantByRequest;
  const invitedPct = participantTotal > 0 ? (participantInvited / participantTotal) * 100 : 0;

  const orgOwnPct = createdActive > 0 ? (createdAsOrganizer / createdActive) * 100 : 0;

  /**
   * Duas árvores de derivação:
   *  - "Criados" origina "Organizador" e "Participante" (eventos seus);
   *  - "Criados por outros usuários" origina "Co-organizador" e "Participante".
   */
  const branches = [
    {
      id: 'all' as const,
      label: 'Criados',
      value: createdActive,
      icon: 'edit_calendar',
      panel: 'from-[#1C2E4A] via-[#2B466F] to-[#456086]',
      flow: 'text-[#1C2E4A]/45',
      junction: 'bg-[#1C2E4A]/70',
      caption: 'Eventos que você criou. A "Responsabilidade pela organização" define seu papel.',
      children: [
        {
          id: 'lead' as const,
          label: 'Organizador',
          value: createdAsOrganizer,
          icon: 'shield_person',
          accent: 'navy',
          hint: 'Eventos que você criou com papel de organização (ação interna ou evento coletivo).',
        },
        {
          id: 'created_participant' as const,
          label: 'Participante',
          value: createdAsParticipant,
          icon: 'person',
          accent: 'amber',
          hint: 'Eventos que você criou apenas participando (participação externa).',
        },
      ],
    },
    {
      id: 'others' as const,
      label: 'Criados por outros usuários',
      value: othersActive,
      icon: 'group',
      panel: 'from-[#456086] via-[#5B7DAA] to-[#7C97BB]',
      flow: 'text-[#456086]/45',
      junction: 'bg-[#456086]/70',
      caption: 'Eventos de outras pessoas em que você está envolvido de forma ativa.',
      children: [
        {
          id: 'organizer' as const,
          label: 'Co-organizador',
          value: orgOther,
          icon: 'assignment_ind',
          accent: 'steel',
          hint: 'Eventos de outras pessoas em que te definiram como organizador na criação — sem você ter criado.',
        },
        {
          id: 'participant' as const,
          label: 'Participante',
          value: partOther,
          icon: 'person',
          accent: 'sky',
          hint: 'Eventos de outras pessoas em que você participa (por convite ou iniciativa própria).',
        },
      ],
    },
  ];

  const secondary = [
    {
      id: 'withdrawn' as const,
      label: 'Retirou-se',
      value: withdrawn,
      icon: 'logout',
      accent: 'mist',
      hint: 'Eventos dos quais você saiu ou foi retirado.',
    },
    {
      id: 'removed' as const,
      label: 'Removido',
      value: removed,
      icon: 'person_remove',
      accent: 'graphite',
      hint: 'Convites e solicitações recusados ou removidos.',
    },
  ];

  // Como cada nível de envolvimento é assumido (regras do sistema).
  const origins = [
    {
      icon: 'add_box',
      accent: 'navy',
      title: 'Você cria o evento',
      caption: 'O nível vem da responsabilidade escolhida:',
      rules: [
        { label: 'Ação interna ou evento coletivo', value: 'Organizador' },
        { label: 'Participação externa', value: 'Participante' },
      ],
    },
    {
      icon: 'group_add',
      accent: 'steel',
      title: 'Alguém te inclui na criação',
      caption: 'Só quem cria o evento pode te colocar como:',
      rules: [
        { label: 'Co-organizador', value: 'Co-organizador' },
        { label: 'Participante', value: 'Participante' },
      ],
    },
    {
      icon: 'how_to_reg',
      accent: 'sky',
      title: 'Você entra por conta própria',
      caption: 'Pelo detalhamento do evento, você se adiciona como:',
      rules: [{ label: 'Participante', value: 'Participante' }],
    },
  ];

  // Distribuição — apenas os "nós-folha" (evita dupla contagem com os pais).
  const segments = [
    { id: 'lead' as const, label: 'Org. (criados)', value: createdAsOrganizer, bar: ACCENT.navy.bar },
    { id: 'created_participant' as const, label: 'Part. (criados)', value: createdAsParticipant, bar: ACCENT.amber.bar },
    { id: 'organizer' as const, label: 'Co-organizador', value: orgOther, bar: ACCENT.steel.bar },
    { id: 'participant' as const, label: 'Participante', value: partOther, bar: ACCENT.sky.bar },
    { id: 'withdrawn' as const, label: 'Retirou-se', value: withdrawn, bar: ACCENT.mist.bar },
    { id: 'removed' as const, label: 'Removido', value: removed, bar: ACCENT.graphite.bar },
  ];
  const grandTotal = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="relative z-10 space-y-3">
      <DerivationStyles />

      {/* Árvores de derivação: cartão-pai origina os cartões-filho */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        {branches.map((branch) => {
          const parentActive = activeTab === branch.id;
          return (
            <div
              key={branch.id}
              className="flex flex-col rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50/70 via-white to-white p-3 md:p-4 shadow-[0_12px_32px_-18px_rgba(28,46,74,0.3)]"
            >
              {/* Cartão-pai (raiz da árvore) */}
              <button
                onClick={() => onTabChange(branch.id)}
                title={
                  parentActive
                    ? `${branch.caption} Clique novamente para ver todos os eventos.`
                    : branch.caption
                }
                aria-label={`${branch.label}: ${branch.caption}`}
                className={`
                  group relative w-full overflow-hidden rounded-2xl border bg-gradient-to-br ${branch.panel} p-4 text-left text-white transition-all duration-300
                  ${parentActive
                    ? 'border-transparent ring-2 ring-[#F2C14E] shadow-[0_22px_48px_-18px_rgba(28,46,74,0.85)]'
                    : 'border-transparent shadow-[0_18px_40px_-18px_rgba(28,46,74,0.7)] hover:shadow-[0_26px_54px_-18px_rgba(28,46,74,0.9)] hover:-translate-y-1'}
                `}
              >
                {/* Brilhos de fundo */}
                <span className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-white/10 blur-2xl" />
                <span className="pointer-events-none absolute -bottom-12 -left-6 size-28 rounded-full bg-[#F2C14E]/20 blur-2xl" />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <span className="material-symbols-outlined text-[22px]">{branch.icon}</span>
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-[13px] font-black uppercase tracking-widest">
                        {branch.label}
                      </h4>
                      <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-white/65">
                        {branch.caption}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-4xl font-black leading-none tracking-tight">{branch.value}</span>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/55">
                      eventos
                    </p>
                  </div>
                </div>

                {/* Derivação explícita */}
                <div className="relative mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/15 pt-2.5">
                  <span className="material-symbols-outlined text-[13px] text-[#F2C14E]">account_tree</span>
                  <span className="mr-1 text-[9px] font-black uppercase tracking-widest text-white/50">
                    Origina
                  </span>
                  {branch.children.map((child) => (
                    <span
                      key={child.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold"
                    >
                      <span className="material-symbols-outlined text-[12px]">{child.icon}</span>
                      {child.label}
                    </span>
                  ))}
                </div>

                {parentActive && (
                  <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#F2C14E] px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-[#1C2E4A] shadow-sm">
                    vendo
                    <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  </span>
                )}
              </button>

              {/* Conector de derivação: haste → barra → quedas (fluxo animado) */}
              <div className="relative h-9 shrink-0" aria-hidden>
                <span className={`ms-flow-y absolute left-1/2 top-0 h-4 w-[2px] -translate-x-1/2 ${branch.flow}`} />
                <span className={`ms-flow-x absolute left-1/4 right-1/4 top-4 h-[2px] ${branch.flow}`} />
                <span className={`ms-flow-y absolute left-1/4 top-4 h-5 w-[2px] -translate-x-1/2 ${branch.flow}`} />
                <span className={`ms-flow-y absolute left-3/4 top-4 h-5 w-[2px] -translate-x-1/2 ${branch.flow}`} />
                <span className={`absolute left-1/2 top-4 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${branch.junction}`} />
              </div>

              {/* Cartões-filho */}
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                {branch.children.map((child) => {
                  const isActive = activeTab === child.id;
                  const accent = ACCENT[child.accent];
                  const pct = branch.value > 0 ? Math.round((child.value / branch.value) * 100) : 0;
                  return (
                    <button
                      key={child.id}
                      onClick={() => onTabChange(child.id)}
                      title={isActive ? `${child.hint} Clique novamente para ver todos os eventos.` : child.hint}
                      aria-label={`${child.label}: ${child.hint}`}
                      className={`
                        group flex flex-1 flex-col rounded-2xl border p-4 text-left transition-all duration-300
                        ${isActive
                          ? `${accent.active} shadow-md`
                          : `bg-white border-slate-100 ${CARD_DEPTH} hover:border-slate-200`}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                            isActive ? accent.chip : 'bg-slate-50 text-slate-400 group-hover:text-slate-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{child.icon}</span>
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest opacity-70">
                            vendo
                            <span className="size-1.5 rounded-full bg-current animate-pulse" />
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-3xl font-black tracking-tight leading-none">{child.value}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'opacity-70' : 'text-slate-400'}`}>
                          {child.label}
                        </span>
                      </div>

                      <div className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${isActive ? 'bg-white/40' : 'bg-slate-200/70'}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${accent.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className={`mt-1.5 text-[10px] font-semibold ${isActive ? 'opacity-70' : 'text-slate-500'}`}>
                        {pct}% do cartão “{branch.label}”
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Situações de saída / recusa */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {secondary.map((item) => {
          const isActive = activeTab === item.id;
          const accent = ACCENT[item.accent];
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={isActive ? `${item.hint} Clique novamente para ver todos os eventos.` : item.hint}
              aria-label={`${item.label}: ${item.hint}`}
              className={`
                group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 text-left
                ${isActive ? `${accent.active} shadow-md` : `bg-white border-slate-100 ${CARD_DEPTH} hover:border-slate-200`}
              `}
            >
              <span className={`flex items-center justify-center size-8 rounded-lg shrink-0 ${isActive ? accent.chip : 'bg-slate-50 text-slate-400 group-hover:text-slate-600'}`}>
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-xl font-black tracking-tight leading-none">{item.value}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'opacity-70' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Distribuição geral — clique numa faixa para filtrar */}
      {grandTotal > 0 && (
        <div className="relative z-10 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_10px_28px_-16px_rgba(28,46,74,0.3)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Distribuição do seu envolvimento
            </span>
            <span className="text-[10px] font-bold text-slate-400">{grandTotal} eventos</span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            {segments.filter(s => s.value > 0).map(s => (
              <button
                key={s.id}
                onClick={() => onTabChange(s.id)}
                title={`${s.label}: ${s.value}`}
                style={{ width: `${(s.value / grandTotal) * 100}%` }}
                className={`h-full ${s.bar} transition-opacity hover:opacity-75 ${activeTab === s.id ? 'opacity-100' : 'opacity-70'}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {segments.filter(s => s.value > 0).map(s => (
              <span key={s.id} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                <span className={`size-2 rounded-full ${s.bar}`} />
                {s.label} · {s.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Como cada nível é assumido — mapa das regras do sistema */}
      <div className="relative z-10 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 shadow-[0_10px_28px_-18px_rgba(28,46,74,0.25)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[18px] text-slate-400">route</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Como você assume cada nível de envolvimento
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {origins.map((origin) => {
            const accent = ACCENT[origin.accent];
            return (
              <div key={origin.title} className={`rounded-xl border bg-white/70 p-3.5 ${accent.soft}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center size-7 rounded-lg ${accent.chip}`}>
                    <span className="material-symbols-outlined text-[16px]">{origin.icon}</span>
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-700">
                    {origin.title}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-500 leading-relaxed">{origin.caption}</p>
                <ul className="mt-1.5 space-y-1">
                  {origin.rules.map((rule) => (
                    <li key={rule.label} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span className={`size-1.5 rounded-full ${accent.bar} shrink-0`} />
                      <span className="font-medium">{rule.label}</span>
                      <span className="text-slate-300">→</span>
                      <span className={`font-bold ${accent.text}`}>{rule.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
