import React from 'react';

type TabId = 'all' | 'organizer' | 'participant' | 'withdrawn' | 'removed';

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

export const StatsCards: React.FC<StatsProps> = ({ stats, activeTab, onTabChange }) => {
  const withdrawn = stats.invitesWithdrawn || 0;
  const removed = stats.invitesRejected + stats.requestsRejected;
  const createdAsOrganizer = stats.createdAsOrganizer || 0;
  const createdAsParticipant = stats.createdAsParticipant || 0;
  const createdTotal = createdAsOrganizer + createdAsParticipant;
  const organizerPct = createdTotal > 0 ? (createdAsOrganizer / createdTotal) * 100 : 0;

  const participantInvited = stats.participantInvited || 0;
  const participantByRequest = stats.participantByRequest || 0;
  const participantTotal = participantInvited + participantByRequest;
  const invitedPct = participantTotal > 0 ? (participantInvited / participantTotal) * 100 : 0;

  // "Meu envolvimento" em 3 frentes: o que eu criei, o que me deram para
  // co-organizar (eventos de outras pessoas) e o que eu apenas participo.
  const primary = [
    {
      id: 'all' as const,
      label: 'Criados',
      value: stats.totalCreated,
      icon: 'edit_calendar',
      accent: 'navy',
      hint: 'Eventos que você criou. O nível vem da "Responsabilidade pela organização".',
    },
    {
      id: 'organizer' as const,
      label: 'Co-organizador',
      value: stats.organizer,
      icon: 'assignment_ind',
      accent: 'steel',
      hint: 'Eventos de outras pessoas em que te definiram como organizador na criação — sem você ter criado.',
    },
    {
      id: 'participant' as const,
      label: 'Participante',
      value: stats.participant,
      icon: 'person',
      accent: 'sky',
      hint: 'Eventos de outras pessoas em que você participa.',
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

  const segments = [
    { id: 'all' as const, label: 'Criados', value: stats.totalCreated, bar: ACCENT.navy.bar },
    { id: 'organizer' as const, label: 'Co-organizador', value: stats.organizer, bar: ACCENT.steel.bar },
    { id: 'participant' as const, label: 'Participante', value: stats.participant, bar: ACCENT.sky.bar },
    { id: 'withdrawn' as const, label: 'Retirou-se', value: withdrawn, bar: ACCENT.mist.bar },
    { id: 'removed' as const, label: 'Removido', value: removed, bar: ACCENT.graphite.bar },
  ];
  const grandTotal = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-3">
      {/* Frentes principais do seu envolvimento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {primary.map((item) => {
          const isActive = activeTab === item.id;
          const accent = ACCENT[item.accent];
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={isActive ? `${item.hint} Clique novamente para ver todos os eventos.` : item.hint}
              aria-label={`${item.label}: ${item.hint}`}
              className={`
                group relative flex flex-col text-left rounded-3xl border p-5 transition-all duration-300 overflow-hidden
                ${isActive ? `${accent.active} shadow-sm` : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-md hover:-translate-y-0.5'}
              `}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`flex items-center justify-center size-10 rounded-xl transition-colors ${isActive ? accent.chip : 'bg-slate-50 text-slate-400 group-hover:text-slate-600'}`}>
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                </div>
                {isActive && (
                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest opacity-70">
                    vendo
                    <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight leading-none">{item.value}</span>
                <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? 'opacity-70' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </div>

              {item.id === 'all' && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                    <div className="h-full bg-[#1C2E4A] transition-all duration-500" style={{ width: `${organizerPct}%` }} />
                    <div className="h-full bg-[#7C97BB] transition-all duration-500" style={{ width: `${100 - organizerPct}%` }} />
                  </div>
                  <p className={`text-[10px] font-semibold ${isActive ? 'opacity-70' : 'text-slate-500'}`}>
                    {createdAsOrganizer} organizando · {createdAsParticipant} participando
                  </p>
                </div>
              )}

              {item.id === 'participant' && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                    <div className="h-full bg-[#7C97BB] transition-all duration-500" style={{ width: `${invitedPct}%` }} />
                    <div className="h-full bg-[#9AB1D0] transition-all duration-500" style={{ width: `${100 - invitedPct}%` }} />
                  </div>
                  <p className={`text-[10px] font-semibold ${isActive ? 'opacity-70' : 'text-slate-500'}`}>
                    {participantInvited} por convite · {participantByRequest} por iniciativa própria
                  </p>
                </div>
              )}

              {item.id === 'organizer' && (
                <p className={`mt-4 text-[10px] font-semibold leading-relaxed ${isActive ? 'opacity-70' : 'text-slate-500'}`}>
                  Só quando alguém te inclui na criação do evento de outra pessoa.
                </p>
              )}
            </button>
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
                ${isActive ? `${accent.active} shadow-sm` : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm hover:-translate-y-0.5'}
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
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
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
      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
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
