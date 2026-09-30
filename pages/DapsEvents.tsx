import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDapsEvents } from '../hooks/useDapsEvents';
import { DapsKpis } from '../components/Daps/DapsKpis';
import { DapsCadence } from '../components/Daps/DapsCadence';
import { DapsCompetencia } from '../components/Daps/DapsCompetencia';
import { DapsCalendar } from '../components/Daps/DapsCalendar';
import { DapsTeam } from '../components/Daps/DapsTeam';
import { DAPS_ROLE_COLORS } from '../lib/constants';

const DapsEvents: React.FC = () => {
  const { events, people, sectors, pairs, stats, loading, error, refresh } = useDapsEvents();
  const navigate = useNavigate();

  const goToEvent = (event: { dateStart?: string; id: string }) => {
    const dateStr = event.dateStart
      ? new Date(event.dateStart).toISOString().split('T')[0]
      : '';
    navigate(
      `/calendar?date=${dateStr}&view=agenda&eventId=${event.id}&tab=details&from=/eventos-daps`
    );
  };

  // Métricas extras para destaque visual
  const highlightMetrics = useMemo(() => {
    if (events.length === 0) return null;

    const totalOrganizers = stats.organizerRoles;
    const totalCoOrganizers = stats.coOrganizerRoles;
    const totalParticipants = stats.participantRoles;
    const totalRoles = totalOrganizers + totalCoOrganizers + totalParticipants || 1;

    const orgPct = Math.round((totalOrganizers / totalRoles) * 100);
    const coOrgPct = Math.round((totalCoOrganizers / totalRoles) * 100);
    const partPct = 100 - orgPct - coOrgPct;

    // Evento com mais envolvidos
    const mostInvolved = [...events].sort((a, b) => b.involved.length - a.involved.length)[0];

    // Evento com mais organizadores
    const mostOrgs = [...events].sort((a, b) => b.organizerCount - a.organizerCount)[0];

    return {
      orgPct,
      coOrgPct,
      partPct,
      mostInvolved,
      mostOrgs,
    };
  }, [events, stats]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#7C97BB]/10 to-[#1C2E4A]/5 border border-[#1C2E4A]/10 px-6 md:px-8 py-7 md:py-8 shadow-sm">
        <div className="absolute -top-16 -right-16 size-48 rounded-full bg-[#1C2E4A]/8 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 size-36 rounded-full bg-[#7C97BB]/15 blur-2xl" />

        <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center size-10 rounded-2xl bg-[#1C2E4A] text-white shadow-md shadow-[#1C2E4A]/30">
                <span className="material-symbols-outlined text-[20px]">campaign</span>
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#456086]">
                  Mobilização
                </p>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  Eventos DAPS
                </h1>
              </div>
            </div>
            <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-xl">
              Controle e visão detalhada dos eventos de natureza{' '}
              <strong className="text-slate-700">EVENTO DAPS</strong>: quem se envolve, em qual
              nível, com que frequência e quantos dias separam um evento do outro.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[12px] font-bold text-slate-600">
              <span className="material-symbols-outlined text-[16px] text-[#456086]">bolt</span>
              {stats.totalEvents} {stats.totalEvents === 1 ? 'evento' : 'eventos'} •{' '}
              {stats.totalInvolved} envolvidos
            </span>
            <button
              onClick={() => refresh()}
              className="size-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-[#1C2E4A] hover:border-[#1C2E4A]/20 hover:bg-[#1C2E4A]/5 transition-all group"
              title="Sincronizar dados"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform duration-700 group-hover:rotate-180">
                refresh
              </span>
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <span className="material-symbols-outlined text-[20px]">error</span>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <span className="material-symbols-outlined animate-spin text-[36px] text-[#1C2E4A]">
            progress_activity
          </span>
          <p className="text-sm font-semibold text-slate-400">Carregando eventos DAPS…</p>
        </div>
      ) : (
        <>
          {/* 1. KPIs */}
          <DapsKpis stats={stats} />

          {/* 2. Cadência — DESTAQUE PRINCIPAL */}
          <section className="relative overflow-hidden rounded-3xl border-2 border-[#1C2E4A]/12 bg-gradient-to-br from-[#7C97BB]/10 via-white to-[#1C2E4A]/5 shadow-md">
            {/* Decoração de fundo */}
            <div className="absolute -top-20 -right-20 size-64 rounded-full bg-[#1C2E4A]/8 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-[#7C97BB]/12 blur-3xl" />

            <div className="relative">
              <DapsCadence events={events} stats={stats} />
            </div>
          </section>

          {/* 3. Levantamento por competência (mês/ano) + calendário mensal na mesma linha */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-stretch">
            <DapsCompetencia events={events} />
            <DapsCalendar events={events} onSelectEvent={goToEvent} />
          </div>

          {/* 4. Métricas destaque — Cards mini-resumo */}
          {highlightMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Distribuição de papéis */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Distribuição de papéis
                </p>
                <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-[#1C2E4A] transition-all" style={{ width: `${highlightMetrics.orgPct}%` }} />
                  <div className="bg-[#456086] transition-all" style={{ width: `${highlightMetrics.coOrgPct}%` }} />
                  <div className="bg-[#7C97BB] transition-all" style={{ width: `${highlightMetrics.partPct}%` }} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#1C2E4A]" />
                    {highlightMetrics.orgPct}% org.
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#456086]" />
                    {highlightMetrics.coOrgPct}% co-org.
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#7C97BB]" />
                    {highlightMetrics.partPct}% part.
                  </span>
                </div>
              </div>

              {/* Evento com mais envolvidos */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Maior engajamento
                </p>
                {highlightMetrics.mostInvolved && (
                  <div className="space-y-2">
                    <p
                      className="text-[15px] font-bold text-slate-800 line-clamp-1 hover:text-[#1C2E4A] transition-colors cursor-pointer"
                      onClick={() => goToEvent(highlightMetrics.mostInvolved!)}
                      title="Clique para ver no calendário"
                    >
                      {highlightMetrics.mostInvolved.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black text-[#1C2E4A]">
                        {highlightMetrics.mostInvolved.involved.length}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        envolvidos
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {highlightMetrics.mostInvolved.organizerCount > 0 && (
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${DAPS_ROLE_COLORS.ORGANIZADOR.chip}`}>
                          <span className="material-symbols-outlined text-[13px]">shield_person</span>
                          {highlightMetrics.mostInvolved.organizerCount}
                        </span>
                      )}
                      {highlightMetrics.mostInvolved.coOrganizerCount > 0 && (
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${DAPS_ROLE_COLORS.CO_ORGANIZADOR.chip}`}>
                          <span className="material-symbols-outlined text-[13px]">assignment_ind</span>
                          {highlightMetrics.mostInvolved.coOrganizerCount}
                        </span>
                      )}
                      {highlightMetrics.mostInvolved.participantCount > 0 && (
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${DAPS_ROLE_COLORS.PARTICIPANTE.chip}`}>
                          <span className="material-symbols-outlined text-[13px]">person</span>
                          {highlightMetrics.mostInvolved.participantCount}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Equipe e parcerias */}
          <DapsTeam people={people} sectors={sectors} pairs={pairs} />
        </>
      )}
    </div>
  );
};

export default DapsEvents;
