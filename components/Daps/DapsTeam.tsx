import React from 'react';
import {
  DapsPair,
  DapsPerson,
  LEVEL_ORGANIZER,
  LEVEL_CO_ORGANIZER,
  LEVEL_PARTICIPANT,
} from '../../hooks/useDapsEvents';
import { getAvatarUrl } from '../../lib/pocketbase';
import { DAPS_ROLE_COLORS } from '../../lib/constants';

interface Props {
  people: DapsPerson[];
  pairs: DapsPair[];
}

export const DapsTeam: React.FC<Props> = ({ people, pairs }) => {
  const topScore = people[0]?.score || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
      {/* Ranking de engajamento com 3 níveis */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-xl bg-[#1C2E4A]/10 text-[#1C2E4A]">
            <span className="material-symbols-outlined text-[22px]">military_tech</span>
          </span>
          <div>
            <h3 className="text-base font-black uppercase tracking-widest text-slate-700">
              Engajamento da equipe
            </h3>
            <p className="text-xs font-medium text-slate-400">
              Quem mais se envolve e em qual nível — Organizador, Co-organizador ou Participante
            </p>
          </div>
        </div>

        {people.length === 0 ? (
          <p className="mt-6 text-center text-sm font-semibold text-slate-400">
            Nenhum envolvido registrado ainda.
          </p>
        ) : (
          <div className="mt-5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {people.map((person, index) => {
              const pct = Math.max(6, (person.score / topScore) * 100);
              return (
                <div
                  key={person.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-slate-50"
                >
                  <span
                    className={`w-6 shrink-0 text-center text-sm font-black ${
                      index === 0 ? 'text-[#1C2E4A]' : index < 3 ? 'text-slate-500' : 'text-slate-300'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <img
                    src={getAvatarUrl(person) || undefined}
                    alt={person.name}
                    className="size-11 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[15px] font-bold text-slate-800">{person.name}</p>
                      <span className="shrink-0 text-xs font-black text-slate-500">
                        {person.total} {person.total === 1 ? 'evento' : 'eventos'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#1C2E4A] to-[#5B7DAA] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-[11px] font-bold">
                        {person.asOrganizer > 0 && (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${DAPS_ROLE_COLORS.ORGANIZADOR.chip}`}>
                            <span className="material-symbols-outlined text-[14px]">shield_person</span>
                            {person.asOrganizer}
                          </span>
                        )}
                        {person.asCoOrganizer > 0 && (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${DAPS_ROLE_COLORS.CO_ORGANIZADOR.chip}`}>
                            <span className="material-symbols-outlined text-[14px]">assignment_ind</span>
                            {person.asCoOrganizer}
                          </span>
                        )}
                        {person.asParticipant > 0 && (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${DAPS_ROLE_COLORS.PARTICIPANTE.chip}`}>
                            <span className="material-symbols-outlined text-[14px]">person</span>
                            {person.asParticipant}
                          </span>
                        )}
                      </div>
                    </div>
                    {person.sector && (
                      <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {person.sector}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Parcerias frequentes — dividem a mesma linha com o ranking */}
      <section className="flex-1 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-xl bg-[#5B7DAA]/12 text-[#5B7DAA]">
            <span className="material-symbols-outlined text-[22px]">diversity_3</span>
          </span>
          <h3 className="text-base font-black uppercase tracking-widest text-slate-700">
            Parcerias frequentes
          </h3>
        </div>

        {pairs.length === 0 ? (
          <p className="mt-4 text-center text-sm font-semibold text-slate-400">
            Ainda não há parcerias recorrentes.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {pairs.map((pair) => (
              <li
                key={pair.key}
                className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5"
              >
                <div className="flex -space-x-2 shrink-0">
                  <img
                    src={getAvatarUrl(pair.a) || undefined}
                    alt={pair.a.name}
                    className="size-7 rounded-full border-2 border-white object-cover"
                  />
                  <img
                    src={getAvatarUrl(pair.b) || undefined}
                    alt={pair.b.name}
                    className="size-7 rounded-full border-2 border-white object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-700">
                    {pair.a.name.split(' ')[0]} + {pair.b.name.split(' ')[0]}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-[#7C97BB]/15 px-2 py-1 text-[11px] font-black text-[#456086]">
                  {pair.count}x juntos
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
