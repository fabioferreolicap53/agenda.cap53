import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import { Collections } from '../lib/pocketbase-types';
import { useAuth } from '../components/AuthContext';

// Tipo/natureza que caracteriza um evento DAPS (campo `type` é texto na coleção).
export const DAPS_TYPE = 'EVENTO DAPS';

const DAY_MS = 86400000;

// Três níveis de envolvimento nos eventos DAPS.
// ORGANIZADOR  = criador do evento com `creator_role === 'ORGANIZADOR'`
// CO_ORGANIZADOR = participante convidado que recebeu papel ORGANIZADOR pelo criador
// PARTICIPANTE  = criador com `creator_role === 'PARTICIPANTE'` OU convidado sem papel de org.
export const LEVEL_ORGANIZER = 'ORGANIZADOR';
export const LEVEL_CO_ORGANIZER = 'CO_ORGANIZADOR';
export const LEVEL_PARTICIPANT = 'PARTICIPANTE';

/** Para compat retro nos componentes que ainda chamam `role`. */
export const ROLE_ORGANIZER = LEVEL_ORGANIZER;
export const ROLE_PARTICIPANT = LEVEL_PARTICIPANT;

export const getLevelLabel = (level: string): string => {
  switch (level) {
    case LEVEL_ORGANIZER:
      return 'Organizador';
    case LEVEL_CO_ORGANIZER:
      return 'Co-organizador';
    case LEVEL_PARTICIPANT:
      return 'Participante';
    default:
      return 'Participante';
  }
};

/** Label legado para componentes que ainda referenciam `role`. */
export const getRoleLabel = (role?: string): string => getLevelLabel(role || LEVEL_PARTICIPANT);

export const getLevelIcon = (level: string): string => {
  switch (level) {
    case LEVEL_ORGANIZER:
      return 'shield_person';
    case LEVEL_CO_ORGANIZER:
      return 'assignment_ind';
    case LEVEL_PARTICIPANT:
      return 'person';
    default:
      return 'person';
  }
};

export interface DapsInvolved {
  id: string;
  name: string;
  avatar?: string;
  sector?: string;
  /** Nível de envolvimento real: ORGANIZADOR | CO_ORGANIZADOR | PARTICIPANTE */
  level: string;
  /** Legado — mantido para retro-compat. Igual a `level`. */
  role: string;
  isCreator: boolean;
  status?: string;
}

export interface DapsGap {
  days: number;
  from: DapsEvent;
  to: DapsEvent;
}

export interface DapsEvent {
  id: string;
  title: string;
  description?: string;
  dateStart?: string;
  dateEnd?: string;
  location: string;
  creatorId: string;
  creatorName: string;
  creatorRole: string;
  responsibility?: string;
  estimatedParticipants?: number;
  unidades: string[];
  categorias: string[];
  involved: DapsInvolved[];
  organizerCount: number;
  coOrganizerCount: number;
  participantCount: number;
  confirmedCount: number;
  pendingCount: number;
  gapBefore: number | null;
  isPast: boolean;
}

export interface DapsPerson {
  id: string;
  name: string;
  avatar?: string;
  sector?: string;
  total: number;
  asOrganizer: number;
  asCoOrganizer: number;
  asParticipant: number;
  score: number;
  lastDate?: string;
  eventIds: string[];
}

export interface DapsSector {
  sector: string;
  people: number;
  events: number;
}

export interface DapsPair {
  key: string;
  a: DapsPerson;
  b: DapsPerson;
  count: number;
}

export interface DapsStats {
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  totalInvolved: number;
  avgInvolved: number;
  organizerRoles: number;
  coOrganizerRoles: number;
  participantRoles: number;
  nextEvent?: DapsEvent;
  daysToNext: number | null;
  lastEvent?: DapsEvent;
  daysSinceLast: number | null;
  avgGapDays: number | null;
  shortestGap: DapsGap | null;
  longestGap: DapsGap | null;
}

export interface DapsData {
  events: DapsEvent[];
  people: DapsPerson[];
  sectors: DapsSector[];
  pairs: DapsPair[];
  stats: DapsStats;
}

const EMPTY: DapsData = {
  events: [],
  people: [],
  sectors: [],
  pairs: [],
  stats: {
    totalEvents: 0,
    upcomingEvents: 0,
    pastEvents: 0,
    totalInvolved: 0,
    avgInvolved: 0,
    organizerRoles: 0,
    coOrganizerRoles: 0,
    participantRoles: 0,
    daysToNext: null,
    daysSinceLast: null,
    avgGapDays: null,
    shortestGap: null,
    longestGap: null,
  },
};

// Campos JSON do PocketBase podem chegar como objeto ou string.
const asObj = (value: any): Record<string, string> => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }
  return value;
};

/**
 * Um envolvido só conta como participação efetiva quando confirmou presença
 * (`accepted`). Status ausente — eventos antigos sem `participants_status` — é
 * tratado como aceito. Convites pendentes (`pending`), recusas
 * (`declined`/`rejected`) e desistências (`withdrawn`) não são participação.
 */
const hasParticipated = (person: DapsInvolved): boolean =>
  (person.status || 'accepted') === 'accepted';

const diffInDays = (from?: string, to?: string): number | null => {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / DAY_MS);
};

const startOfToday = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Ordem dos níveis para ordenação (quem organiza fica acima). */
const levelWeight = (level: string): number => {
  if (level === LEVEL_ORGANIZER) return 0;
  if (level === LEVEL_CO_ORGANIZER) return 1;
  return 2;
};

/**
 * Consolida os eventos do tipo "EVENTO DAPS" com o nível de engajamento de
 * todos os envolvidos (Organizador / Co-organizador / Participante), a cadência
 * (dias entre um evento e o outro) e agregados por pessoa / setor / parcerias.
 */
export const useDapsEvents = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DapsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDapsEvents = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await pb.collection(Collections.AgendaCap53Eventos).getFullList<any>({
        filter: `type ~ "${DAPS_TYPE}"`,
        sort: 'date_start',
        expand: 'user,location,participants',
      });

      const records = response
        // Restringe ao tipo exato "EVENTO DAPS" (ignora variações como "DAPS" ou
        // "EVENTO DAPS ESPECIAL"), garantindo que a página só mostre esse tipo.
        .filter((e) => String(e.type || '').trim().toUpperCase() === DAPS_TYPE)
        .filter((e) => e.status !== 'canceled')
        .sort(
          (a, b) =>
            new Date(a.date_start || 0).getTime() - new Date(b.date_start || 0).getTime()
        );

      // Participações gravadas na coleção dedicada. É a fonte de verdade: o
      // array `participants` / JSON `participants_status` do evento pode não
      // ser atualizado quando quem participa não é o criador/admin (regras de
      // API do PocketBase), então a página DAPS precisa ler daqui também.
      const participacoes = records.length
        ? await pb.collection(Collections.AgendaCap53Participantes).getFullList<any>({
            filter: records.map((e) => `event = "${e.id}"`).join(' || '),
            expand: 'user',
            requestKey: null,
          })
        : [];

      const participacoesPorEvento = new Map<string, any[]>();
      participacoes.forEach((p) => {
        if (!p?.event || !p?.user) return;
        const list = participacoesPorEvento.get(p.event) || [];
        list.push(p);
        participacoesPorEvento.set(p.event, list);
      });

      const today = startOfToday();

      // 1) Monta os eventos com a lista de envolvidos e seus 3 níveis.
      const events: DapsEvent[] = records.map((e) => {
        const statusMap = asObj(e.participants_status);
        const rolesMap = asObj(e.participants_roles);
        const expanded: any[] = Array.isArray(e.expand?.participants) ? e.expand.participants : [];
        const expandedById = new Map(expanded.map((u: any) => [u.id, u]));

        const involvedMap = new Map<string, DapsInvolved>();
        const creatorId: string = e.user;
        const creatorUser = e.expand?.user;
        const creatorLevel = (e.creator_role || LEVEL_ORGANIZER).toUpperCase();

        // Criador → nível veio de creator_role
        if (creatorId) {
          involvedMap.set(creatorId, {
            id: creatorId,
            name: creatorUser?.name || 'Criador',
            avatar: creatorUser?.avatar,
            sector: creatorUser?.sector,
            level: creatorLevel,
            role: creatorLevel,
            isCreator: true,
            status: statusMap[creatorId] || 'accepted',
          });
        }

        // Participantes convidados → nível veio de participants_roles
        const participantIds: string[] = e.participants || [];
        participantIds.forEach((id) => {
          if (involvedMap.has(id)) return;
          const u: any = expandedById.get(id);
          const invitedRole = (rolesMap[id] || '').toUpperCase();
          // Quem recebeu papel ORGANIZADOR de outro usuário é CO_ORGANIZADOR
          const level =
            invitedRole === LEVEL_ORGANIZER ? LEVEL_CO_ORGANIZER : LEVEL_PARTICIPANT;
          involvedMap.set(id, {
            id,
            name: u?.name || 'Usuário',
            avatar: u?.avatar,
            sector: u?.sector,
            level,
            role: level,
            isCreator: false,
            status: statusMap[id],
          });
        });

        // Coleção dedicada é a fonte de verdade do status: cobre quem entrou
        // pelo botão "Participar" e cujo array/JSON do evento não foi
        // atualizado, além de corrigir status desatualizado.
        (participacoesPorEvento.get(e.id) || []).forEach((p: any) => {
          const participantId: string = p.user;
          const status = String(p.status || '').toLowerCase();
          const existing = involvedMap.get(participantId);
          if (existing) {
            if (status) existing.status = status;
            return;
          }
          const u: any = p.expand?.user || expandedById.get(participantId);
          const invitedRole = String(p.role || '').toUpperCase();
          const level =
            invitedRole === LEVEL_ORGANIZER ? LEVEL_CO_ORGANIZER : LEVEL_PARTICIPANT;
          involvedMap.set(participantId, {
            id: participantId,
            name: u?.name || 'Usuário',
            avatar: u?.avatar,
            sector: u?.sector,
            level,
            role: level,
            isCreator: false,
            status,
          });
        });

        // Quem saiu do evento por conta própria (ou foi removido/recusou) não é
        // mais envolvido: sai das contagens, avatares e listas. Convites
        // pendentes continuam listados para o indicador de pendências.
        const leftEvent = (status?: string) =>
          ['withdrawn', 'declined', 'rejected', 'cancelled', 'canceled'].includes(
            (status || '').toLowerCase()
          );
        involvedMap.forEach((person, id) => {
          // O criador nunca sai do próprio evento.
          if (!person.isCreator && leftEvent(person.status)) involvedMap.delete(id);
        });

        const involved = Array.from(involvedMap.values()).sort(
          (a, b) => levelWeight(a.level) - levelWeight(b.level) || a.name.localeCompare(b.name)
        );

        const organizerCount = involved.filter((p) => p.level === LEVEL_ORGANIZER).length;
        const coOrganizerCount = involved.filter((p) => p.level === LEVEL_CO_ORGANIZER).length;
        const pendingCount = involved.filter((p) => p.status === 'pending').length;

        const startTime = e.date_start ? new Date(e.date_start).getTime() : NaN;

        return {
          id: e.id,
          title: e.title || 'Evento DAPS',
          description: e.description,
          dateStart: e.date_start,
          dateEnd: e.date_end,
          location: e.expand?.location?.name || e.custom_location || 'Local não definido',
          creatorId,
          creatorName: creatorUser?.name || 'Criador',
          creatorRole: creatorLevel,
          responsibility: e.event_responsibility,
          estimatedParticipants: e.estimated_participants,
          unidades: e.unidades || [],
          categorias: e.categorias_profissionais || [],
          involved,
          organizerCount,
          coOrganizerCount,
          participantCount: involved.length - organizerCount - coOrganizerCount,
          confirmedCount: involved.filter((p) => (p.status || 'accepted') === 'accepted').length,
          pendingCount,
          gapBefore: null,
          isPast: !isNaN(startTime) ? startTime < today : false,
        };
      });

      // 2) Cadência: dias que separam um evento DAPS do anterior.
      events.forEach((event, index) => {
        if (index === 0) return;
        event.gapBefore = diffInDays(events[index - 1].dateStart, event.dateStart);
      });

      const gaps: DapsGap[] = [];
      events.forEach((event, index) => {
        if (index === 0 || event.gapBefore === null) return;
        gaps.push({ days: event.gapBefore, from: events[index - 1], to: event });
      });

      // 3) Engajamento por pessoa com os 3 níveis.
      // Só entram aqui os envolvidos que efetivamente participaram do evento
      // (status `accepted`), evitando contar convites pendentes ou recusados.
      const peopleMap = new Map<string, DapsPerson>();
      events.forEach((event) => {
        event.involved.filter(hasParticipated).forEach((person) => {
          const current =
            peopleMap.get(person.id) ||
            ({
              id: person.id,
              name: person.name,
              avatar: person.avatar,
              sector: person.sector,
              total: 0,
              asOrganizer: 0,
              asCoOrganizer: 0,
              asParticipant: 0,
              score: 0,
              lastDate: undefined,
              eventIds: [],
            } as DapsPerson);

          current.total += 1;
          if (person.level === LEVEL_ORGANIZER) current.asOrganizer += 1;
          else if (person.level === LEVEL_CO_ORGANIZER) current.asCoOrganizer += 1;
          else current.asParticipant += 1;
          if (!current.eventIds.includes(event.id)) current.eventIds.push(event.id);
          current.lastDate = event.dateStart || current.lastDate;
          // Peso: organizar(3) > co-organizar(2) > participar(1)
          current.score = current.asOrganizer * 3 + current.asCoOrganizer * 2 + current.asParticipant;
          peopleMap.set(person.id, current);
        });
      });

      const people = Array.from(peopleMap.values()).sort(
        (a, b) => b.score - a.score || b.total - a.total || a.name.localeCompare(b.name)
      );

      // 4) Agregado por setor.
      const sectorMap = new Map<string, { people: Set<string>; events: Set<string> }>();
      events.forEach((event) => {
        event.involved.filter(hasParticipated).forEach((person) => {
          const key = person.sector || 'Não informado';
          if (!sectorMap.has(key)) sectorMap.set(key, { people: new Set(), events: new Set() });
          const entry = sectorMap.get(key)!;
          entry.people.add(person.id);
          entry.events.add(event.id);
        });
      });
      const sectors: DapsSector[] = Array.from(sectorMap.entries())
        .map(([sector, agg]) => ({ sector, people: agg.people.size, events: agg.events.size }))
        .sort((a, b) => b.people - a.people || a.sector.localeCompare(b.sector));

      // 5) Parcerias: pessoas que mais aparecem juntas nos eventos DAPS.
      const pairMap = new Map<string, number>();
      events.forEach((event) => {
        const ids = event.involved.filter(hasParticipated).map((p) => p.id).sort();
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const key = `${ids[i]}__${ids[j]}`;
            pairMap.set(key, (pairMap.get(key) || 0) + 1);
          }
        }
      });
      const pairs: DapsPair[] = Array.from(pairMap.entries())
        .map(([key, count]) => {
          const [a, b] = key.split('__');
          return { key, a: peopleMap.get(a)!, b: peopleMap.get(b)!, count };
        })
        .filter((p) => p.a && p.b && p.count > 1)
        .sort((x, y) => y.count - x.count)
        .slice(0, 6);

      // 6) KPIs.
      const todayTime = startOfToday();
      const ordered = events;
      const nextEvent = ordered.find(
        (e) => e.dateStart && new Date(e.dateStart).getTime() >= todayTime
      );
      const pastEvents = ordered.filter(
        (e) => e.dateStart && new Date(e.dateStart).getTime() < todayTime
      );
      const lastEvent = pastEvents[pastEvents.length - 1];

      const totalInvolved = people.length;
      const organizerRoles = events.reduce((sum, e) => sum + e.organizerCount, 0);
      const coOrganizerRoles = events.reduce((sum, e) => sum + e.coOrganizerCount, 0);
      const participantRoles = events.reduce((sum, e) => sum + e.participantCount, 0);

      const avgGapDays = gaps.length
        ? Math.round((gaps.reduce((sum, g) => sum + g.days, 0) / gaps.length) * 10) / 10
        : null;
      const shortestGap = gaps.length
        ? gaps.reduce((min, g) => (g.days < min.days ? g : min), gaps[0])
        : null;
      const longestGap = gaps.length
        ? gaps.reduce((max, g) => (g.days > max.days ? g : max), gaps[0])
        : null;

      const stats: DapsStats = {
        totalEvents: events.length,
        upcomingEvents: events.length - pastEvents.length,
        pastEvents: pastEvents.length,
        totalInvolved,
        avgInvolved: events.length
          ? Math.round((events.reduce((sum, e) => sum + e.involved.length, 0) / events.length) * 10) /
            10
          : 0,
        organizerRoles,
        coOrganizerRoles,
        participantRoles,
        nextEvent,
        daysToNext: nextEvent ? diffInDays(new Date().toISOString(), nextEvent.dateStart) : null,
        lastEvent,
        daysSinceLast: lastEvent ? diffInDays(lastEvent.dateStart, new Date().toISOString()) : null,
        avgGapDays,
        shortestGap,
        longestGap,
      };

      setData({ events, people, sectors, pairs, stats });
    } catch (err) {
      console.error('Erro ao carregar eventos DAPS:', err);
      setError('Não foi possível carregar os eventos DAPS.');
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDapsEvents();

    if (!user?.id) return;

    const collections = [
      Collections.AgendaCap53Eventos,
      Collections.AgendaCap53Participantes,
    ];
    const unsubscribes = collections.map(async (collection) => {
      return await pb.collection(collection).subscribe('*', () => {
        fetchDapsEvents();
      });
    });

    return () => {
      unsubscribes.forEach(async (unsubscribe) => (await unsubscribe)());
    };
  }, [user?.id, fetchDapsEvents]);

  return { ...data, loading, error, refresh: fetchDapsEvents };
};
