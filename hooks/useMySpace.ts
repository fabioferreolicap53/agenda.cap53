import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';

export interface MySpaceEvent {
  id: string;
  title: string;
  description: string;
  date_start: string;
  date_end: string;
  status: string;
  location?: string;
  custom_location?: string;
  user: string;
  creator_role?: string;
  participants: string[];
  category?: string; // Mapeado como "Tipo"
  nature?: string;   // Mapeado como "Natureza"
  logistics_resources?: string; // Mapeado como "Logística & Recursos"
  expand?: {
    location?: {
      name: string;
    };
    user?: {
      name: string;
      avatar?: string;
    };
  };
  userRole?: string;
  type: 'created' | 'participation' | 'request';
  participationStatus?: string;
  requestStatus?: string;
  rejected_by?: string;
  rejected_by_name?: string;
}

export interface AnalyticsData {
  byType: { name: string; value: number }[];
  byNature: { name: string; value: number }[];
  byTime: { name: string; count: number }[];
  byResources: { name: string; count: number }[];
}

export const useMySpace = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<MySpaceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    byType: [],
    byNature: [],
    byTime: [],
    byResources: []
  });
  const [stats, setStats] = useState({
    organizer: 0,
    coorganizer: 0,
    participant: 0,
    // Convites Recebidos
    invitesPending: 0,
    invitesAccepted: 0,
    invitesRejected: 0,
    // Solicitações Enviadas
    requestsPending: 0,
    requestsAccepted: 0,
    requestsRejected: 0,
    // Convites Enviados (por você como criador)
    sentInvitesPending: 0,
    sentInvitesAccepted: 0,
    sentInvitesRejected: 0,
    // Totais
    totalCreated: 0,
    totalParticipated: 0,
    confirmedEvents: 0
  });

  const fetchMySpaceData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // 1. Fetch events created by user
      const createdRes = await pb.collection('agenda_cap53_eventos').getFullList<any>({
        filter: `user = "${user.id}"`,
        sort: '-date_start',
        expand: 'location,user'
      });
      
      const createdWithMeta = createdRes.map(e => {
        return { 
          ...e, 
          type: 'created' as const, 
          userRole: e.creator_role || 'PARTICIPANTE'
        };
      });

      // 2. Fetch participations (Invites received by me OR roles I have in other events)
      const participationsRes = await pb.collection('agenda_cap53_participantes').getFullList({
        filter: `user = "${user.id}"`,
        expand: 'event,event.location,event.user'
      });
      
      const participationEvents = participationsRes
        .filter(p => p.expand?.event)
        .map(p => ({
          ...p.expand.event,
          userRole: p.role || 'PARTICIPANTE',
          type: 'participation' as const,
          participationStatus: p.status
        }))
        .filter(e => e.user !== user.id);

      // 1.1 Fetch ALL participants for events where I am Creator or Organizer/Coorganizer
      // This is for counting "Sent Invites" (Convites Enviados)
      const managedEventIds = new Set<string>();
      createdRes.forEach(e => managedEventIds.add(e.id));
      participationsRes.forEach(p => {
        const role = (p.role || '').toUpperCase();
        if (role === 'ORGANIZADOR' || role === 'COORGANIZADOR') {
          if (p.event) managedEventIds.add(p.event);
        }
      });

      let sentInvites: any[] = [];
      if (managedEventIds.size > 0) {
        const filter = Array.from(managedEventIds).map(id => `event = "${id}"`).join(' || ');
        sentInvites = await pb.collection('agenda_cap53_participantes').getFullList({
          filter: `(${filter}) && user != "${user.id}"`
        });
      }

      // 3. Fetch requests (Solicitations sent)
      const requestsRes = await pb.collection('agenda_cap53_solicitacoes_evento').getFullList({
        filter: `user = "${user.id}"`,
        expand: 'event,event.location,event.user'
      });
      
      const requestEvents = requestsRes
        .filter(r => r.expand?.event)
        .map(r => ({
          ...r.expand.event,
          type: 'request' as const,
          requestStatus: r.status === 'approved' ? 'accepted' : r.status,
          userRole: r.role || 'PARTICIPANTE'
        }));

      // Combine and sort
      const allEvents = [...createdWithMeta, ...participationEvents, ...requestEvents]
        .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());

      setEvents(allEvents);

      // Calculate stats with fine-grained separation
      const breakdown = {
        totalCreated: createdRes.length,
        organizer: 0,
        coorganizer: 0,
        participant: 0,
        // Recebidos
        invitesPending: 0,
        invitesAccepted: 0,
        invitesRejected: 0,
        // Enviados (Solicitações)
        requestsPending: 0,
        requestsAccepted: 0,
        requestsRejected: 0,
        // Enviados (Convites para outros)
        sentInvitesPending: 0,
        sentInvitesAccepted: 0,
        sentInvitesRejected: 0,
        confirmed: 0
      };

      // Count sent invites (from my created events)
      sentInvites.forEach(p => {
        if (p.status === 'pending') breakdown.sentInvitesPending++;
        else if (p.status === 'accepted') breakdown.sentInvitesAccepted++;
        else if (p.status === 'rejected') breakdown.sentInvitesRejected++;
      });

      allEvents.forEach(e => {
        const eventIsActive = e.status === 'active' || e.status === 'confirmed';
        
        // Se for o criador do evento
        if (e.type === 'created') {
          if (eventIsActive) {
            const role = (e.userRole || '').toUpperCase();
            if (role === 'ORGANIZADOR') breakdown.organizer++;
            else if (role === 'COORGANIZADOR') breakdown.coorganizer++;
            else if (role === 'PARTICIPANTE') breakdown.participant++;
            breakdown.confirmed++;
          }
          return;
        }

        // Se for um Convite Recebido (Participation)
        if (e.type === 'participation') {
          if (e.participationStatus === 'accepted') {
            const role = (e.userRole || '').toUpperCase();
            if (role === 'ORGANIZADOR') breakdown.organizer++;
            else if (role === 'COORGANIZADOR') breakdown.coorganizer++;
            else if (role === 'PARTICIPANTE') breakdown.participant++;
            breakdown.invitesAccepted++;
            breakdown.confirmed++;
          } else if (e.participationStatus === 'pending') {
            breakdown.invitesPending++;
          } else if (e.participationStatus === 'rejected') {
            breakdown.invitesRejected++;
          }
          return;
        }

        // Se for uma Solicitação Enviada (Request)
        if (e.type === 'request') {
          if (e.requestStatus === 'accepted') {
            const role = (e.userRole || '').toUpperCase();
            if (role === 'ORGANIZADOR') breakdown.organizer++;
            else if (role === 'COORGANIZADOR') breakdown.coorganizer++;
            else if (role === 'PARTICIPANTE') breakdown.participant++;
            breakdown.requestsAccepted++;
            breakdown.confirmed++;
          } else if (e.requestStatus === 'pending') {
            breakdown.requestsPending++;
          } else if (e.requestStatus === 'rejected') {
            breakdown.requestsRejected++;
          }
        }
      });

      const newStats = {
        totalCreated: breakdown.totalCreated,
        organizer: breakdown.organizer,
        coorganizer: breakdown.coorganizer,
        participant: breakdown.participant,
        invitesPending: breakdown.invitesPending,
        invitesAccepted: breakdown.invitesAccepted,
        invitesRejected: breakdown.invitesRejected,
        requestsPending: breakdown.requestsPending,
        requestsAccepted: breakdown.requestsAccepted,
        requestsRejected: breakdown.requestsRejected,
        sentInvitesPending: breakdown.sentInvitesPending,
        sentInvitesAccepted: breakdown.sentInvitesAccepted,
        sentInvitesRejected: breakdown.sentInvitesRejected,
        totalParticipated: breakdown.confirmed,
        confirmedEvents: breakdown.confirmed
      };

      // Build initial analytics data with empty arrays
      const initialAnalytics: AnalyticsData = {
        byType: [],
        byNature: [],
        byTime: [],
        byResources: []
      };

      // Ensure stats and analytics are always set even if allEvents is empty
      if (allEvents.length === 0) {
        setStats(newStats);
        setAnalytics(initialAnalytics);
        return;
      }

      // Data aggregation logic for analytics
      const typeMap: Record<string, number> = {};
      const natureMap: Record<string, number> = {};
      const timeMap: Record<string, number> = {};
      const resourceMap: Record<string, number> = {};

      allEvents.forEach(e => {
        const isConfirmed = e.type === 'created' || e.participationStatus === 'accepted' || e.requestStatus === 'accepted';
        if (!isConfirmed) return;

        // By Type (Category)
        const type = e.nature || e.category || 'Não Definido';
        typeMap[type] = (typeMap[type] || 0) + 1;

        // By Nature
        const nature = e.nature || 'Não Definida';
        natureMap[nature] = (natureMap[nature] || 0) + 1;

        // By Time (Month/Year)
        try {
          const date = new Date(e.date_start);
          if (!isNaN(date.getTime())) {
            const monthYear = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            timeMap[monthYear] = (timeMap[monthYear] || 0) + 1;
          }
        } catch (err) {
          console.error('Error parsing date for analytics:', e.date_start);
        }

        // By Resources (Logistics)
        if (e.logistics_resources) {
          const resources = e.logistics_resources.split(',').map(r => r.trim());
          resources.forEach(r => {
            if (r) resourceMap[r] = (resourceMap[r] || 0) + 1;
          });
        }
      });

      const processedAnalytics: AnalyticsData = {
        byType: Object.entries(typeMap).map(([name, value]) => ({ name, value })),
        byNature: Object.entries(natureMap).map(([name, value]) => ({ name, value })),
        byTime: Object.entries(timeMap).map(([name, count]) => ({ name, count })),
        byResources: Object.entries(resourceMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      };

      setStats(newStats);
      setAnalytics(processedAnalytics);

    } catch (error) {
      console.error('Error fetching My Space data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMySpaceData();

    if (!user?.id) return;

    const collections = [
      'agenda_cap53_eventos',
      'agenda_cap53_participantes',
      'agenda_cap53_solicitacoes_evento'
    ];

    const unsubscribes = collections.map(async (collection) => {
      return await pb.collection(collection).subscribe('*', () => {
        fetchMySpaceData();
      });
    });

    return () => {
      unsubscribes.forEach(async (u) => (await u)());
    };
  }, [user?.id, fetchMySpaceData]);

  return {
    events,
    loading,
    stats,
    analytics,
    refresh: fetchMySpaceData
  };
};
