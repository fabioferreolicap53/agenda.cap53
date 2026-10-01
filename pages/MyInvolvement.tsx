import { toast } from '../lib/toast';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMySpace, MySpaceEvent } from '../hooks/useMySpace';
import { useAuth } from '../components/AuthContext';
import { deleteEventWithCleanup } from '../lib/eventUtils';
import { notifyEventStatusChange, EventData } from '../lib/notificationUtils';
import { pb } from '../lib/pocketbase';

// Novos componentes modularizados
import ConfirmationModal from '../components/ConfirmationModal';
import { StatsCards } from '../components/MySpace/StatsCards';
import { EventList } from '../components/MySpace/EventList';
import { FilterBar } from '../components/MySpace/FilterBar';
import { AnalyticsSection } from '../components/MySpace/AnalyticsSection';
import RefusalModal from '../components/RefusalModal';

type TabId =
  | 'all'
  | 'lead'
  | 'created_participant'
  | 'others'
  | 'organizer'
  | 'participant'
  | 'withdrawn'
  | 'removed';

const MyInvolvement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Data hooks
  const { events, loading, stats, analytics, refresh } = useMySpace();
  
  // Local state
  // null = nenhum cartão selecionado: mostra todos os eventos sem filtro.
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [confirmationModalConfig, setConfirmationModalConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
  }>({
    title: '',
    description: '',
    onConfirm: () => {},
  });
  
  // Inicializa busca com parâmetro da URL se existir, mas gerencia localmente
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('search') || '';
  });

  // Pagination
  const [visibleCount, setVisibleCount] = useState(10);
  
  // Scroll persistence (container-based)
  const scrollPositions = useRef<Record<string, number>>({});
  const pendingRestoreScroll = useRef<number | null>(null);
  const pendingAnchorId = useRef<string | null>(null);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const getScrollStorageKey = (tab: TabId | null) => `scroll:${location.pathname}:${tab ?? 'none'}`;
  const getScrollContainer = () => document.getElementById('main-scroll-container');
  const getCurrentScroll = () => getScrollContainer()?.scrollTop || 0;
  const persistScroll = (tab: TabId | null, value: number) => {
    scrollPositions.current[tab ?? 'none'] = value;
    sessionStorage.setItem(getScrollStorageKey(tab), String(value));
  };

  // Refusal Modal State for Event Cancellation
  const [refusalModalOpen, setRefusalModalOpen] = useState(false);
  const [eventToCancel, setEventToCancel] = useState<MySpaceEvent | null>(null);
  const [processingCancellation, setProcessingCancellation] = useState(false);

  // Listen and persist scroll continuously on container
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;
    const onScroll = () => {
      if (!loading) {
        persistScroll(activeTab, container.scrollTop);
      }
    };
    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, [activeTab, loading, location.pathname]);

  // Apply restoration loop after loading and data render
  useEffect(() => {
    if (loading) return;
    const stored = sessionStorage.getItem(getScrollStorageKey(activeTab));
    const fallback = stored ? parseInt(stored, 10) : 0;
    const target = pendingRestoreScroll.current ?? scrollPositions.current[activeTab ?? 'none'] ?? fallback;
    pendingRestoreScroll.current = null;
    const apply = (attempt = 0) => {
      const container = getScrollContainer();
      if (!container) return;
      if (pendingAnchorId.current) {
        const el = document.querySelector<HTMLElement>(`[data-anchor="event-${pendingAnchorId.current}"]`);
        if (el) {
          const cr = container.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          const offset = er.top - cr.top + container.scrollTop - 16;
          container.scrollTo({ top: offset, behavior: 'instant' });
        } else if (target) {
          container.scrollTo({ top: target, behavior: 'instant' });
        }
      } else if (target) {
        container.scrollTo({ top: target, behavior: 'instant' });
      }
      if (attempt < 12) {
        requestAnimationFrame(() => apply(attempt + 1));
      }
    };
    requestAnimationFrame(() => apply());
  }, [activeTab, loading, events.length, restoreVersion]);

  // Read scroll and tab parameters from URL when returning from Calendar
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const scrollParam = params.get('scroll');
    const anchorParam = params.get('anchor');
    const urlTab = tabParam && ['all','lead','created_participant','others','organizer','participant','withdrawn','removed'].includes(tabParam)
      ? (tabParam as TabId)
      : null;
    if (urlTab) {
      setActiveTab(urlTab);
    }
    const targetTab: TabId | null = urlTab || activeTab;
    if (anchorParam) {
      pendingAnchorId.current = anchorParam;
    }
    if (scrollParam) {
      const parsed = parseInt(scrollParam, 10);
      pendingRestoreScroll.current = parsed;
      persistScroll(targetTab, parsed);
      setRestoreVersion(v => v + 1);
    } else {
      const stored = sessionStorage.getItem(getScrollStorageKey(targetTab));
      if (stored) {
        const parsed = parseInt(stored, 10);
        pendingRestoreScroll.current = parsed;
        scrollPositions.current[targetTab ?? 'none'] = parsed;
        setRestoreVersion(v => v + 1);
      }
    }
  }, [location.search]);

  // Handlers
  const handleCancelEvent = async (event: MySpaceEvent) => {
    setEventToCancel(event);
    setRefusalModalOpen(true);
  };

  const handleConfirmCancellation = async (justification: string) => {
    if (!eventToCancel) return;
    
    setProcessingCancellation(true);
    try {
      // 1. Atualizar status
      await pb.collection('agenda_cap53_eventos').update(eventToCancel.id, {
        status: 'canceled',
        cancel_reason: justification
      });

      // 2. Notificar envolvidos
      try {
        const updatedEvent = await pb.collection('agenda_cap53_eventos').getOne(eventToCancel.id);
        if (user) {
          await notifyEventStatusChange(updatedEvent as unknown as EventData, 'canceled', justification, user.id);
        }
      } catch (notifErr) {
        console.error('Erro ao enviar notificações de cancelamento:', notifErr);
      }

      // alert('Evento cancelado com sucesso.'); // Removed alert for better UX, or could replace with toast
      refresh();
    } catch (error) {
      console.error('Error cancelling event:', error);
      toast.auto('Erro ao cancelar evento.');
    } finally {
      setProcessingCancellation(false);
      setRefusalModalOpen(false);
      setEventToCancel(null);
    }
  };

  const handleDeleteEvent = async (event: MySpaceEvent) => {
    // Prevent deletion if event has logistics or transport requests
    // Using a quick check here. It might need a full query to be 100% accurate, 
    // but we can check the expand or make a query.
    try {
      const eventDetails = await pb.collection('agenda_cap53_eventos').getOne(event.id);
      const logisticsRequests = await pb.collection('agenda_cap53_almac_requests').getFullList({ filter: `event = "${event.id}"` });
      
      const hasLogisticsRequests = logisticsRequests.length > 0 || eventDetails.transporte_suporte === true;
      if (hasLogisticsRequests) {
          toast.auto('Este evento não pode ser excluído permanentemente porque possui solicitações de logística ou transporte atreladas. Por favor, utilize a opção "Cancelar Evento".');
          return;
      }
    } catch (e) {
      console.error('Error verifying logistics before delete', e);
    }

    setConfirmationModalConfig({
      title: 'Excluir Evento',
      description: `Tem certeza que deseja EXCLUIR permanentemente o evento "${event.title}"? Esta ação não pode ser desfeita e removerá todas as notificações vinculadas aos participantes.`,
      confirmText: 'Excluir',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteEventWithCleanup(event.id, user?.id);
          refresh();
          setConfirmationModalOpen(false);
        } catch (error: any) {
          console.error('Error deleting event:', error);
          const msg = error.data?.message || error.message || 'Erro desconhecido';
          toast.auto(`Erro ao excluir evento: ${msg}`);
        }
      }
    });
    setConfirmationModalOpen(true);
  };

  const handleOpenEventInCalendar = (event: MySpaceEvent) => {
    const eventDate = new Date(event.date_start);
    const dateStr = eventDate.toISOString().split('T')[0];
    const scroll = getCurrentScroll();
    persistScroll(activeTab, scroll);
    navigate(`/calendar?date=${dateStr}&view=agenda&eventId=${event.id}&tab=details&from=${encodeURIComponent(`${location.pathname}?tab=${activeTab}&scroll=${scroll}&anchor=${event.id}`)}`);
  };

  const handleDuplicateEvent = (event: MySpaceEvent) => {
    navigate(`/create-event?duplicate_from=${event.id}`);
  };

  const handleEditEvent = (event: MySpaceEvent) => {
    navigate(`/create-event?edit_from=${event.id}`);
  };

  // Cartões agem como filtro alternável: clicar no cartão já ativo desmarca e
  // volta a mostrar todos os eventos, sem filtro.
  const handleTabChange = (tab: TabId) => {
    setActiveTab(prev => (prev === tab ? null : tab));
  };

  // Reset pagination on tab or search change
  useEffect(() => {
    setVisibleCount(10);
  }, [activeTab, searchTerm]);

  const filteredEvents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    
    let result = events;

    // 1. Filtro por Tab (Status/Papel)
    // REGRA: quem cria o evento é o organizador dele. Por isso os eventos que
    // VOCÊ criou ficam em "Criados" e NÃO aparecem em "Co-organizador"/"Participante"
    // — estas abas listam apenas eventos de OUTRAS pessoas.
    // A árvore de cartões deriva de dois pais:
    //   "Criados" → "Organizador" + "Participante" (eventos seus);
    //   "Criados por outros usuários" → "Co-organizador" + "Participante".
    // Condições de "envolvimento ativo" para eventos criados.
    const isCreatedActive = (e: MySpaceEvent) =>
      e.status !== 'canceled' &&
      e.participationStatus !== 'pending' &&
      e.participationStatus !== 'rejected' &&
      e.participationStatus !== 'withdrawn';
    // Condições de "envolvimento ativo" em eventos de outras pessoas.
    const isOthersActive = (e: MySpaceEvent) => {
      const role = (e.userRole || '').toUpperCase();
      return (
        e.type !== 'created' &&
        (role === 'ORGANIZADOR' || role === 'PARTICIPANTE' || role === 'CONVIDADO') &&
        e.requestStatus !== 'pending' &&
        e.participationStatus !== 'pending' &&
        e.requestStatus !== 'rejected' &&
        e.participationStatus !== 'rejected' &&
        e.participationStatus !== 'withdrawn'
      );
    };

    switch (activeTab) {
      case 'all':
        // Pai "Criados": união dos filhos (Organizador + Participante, em eventos ativos).
        result = events.filter(e => e.type === 'created' && isCreatedActive(e));
        break;
      case 'lead':
        // Filho "Organizador" do cartão "Criados".
        result = events.filter(
          e =>
            e.type === 'created' &&
            isCreatedActive(e) &&
            (e.userRole || '').toUpperCase() !== 'PARTICIPANTE'
        );
        break;
      case 'created_participant':
        // Filho "Participante" do cartão "Criados".
        result = events.filter(
          e =>
            e.type === 'created' &&
            isCreatedActive(e) &&
            (e.userRole || '').toUpperCase() === 'PARTICIPANTE'
        );
        break;
      case 'others':
        // Pai "Criados por outros usuários": união dos filhos.
        result = events.filter(isOthersActive);
        break;
      case 'organizer':
        // Filho "Co-organizador" do cartão "Criados por outros usuários".
        result = events.filter(
          e => isOthersActive(e) && (e.userRole || '').toUpperCase() === 'ORGANIZADOR'
        );
        break;
      case 'participant':
        // Filho "Participante" do cartão "Criados por outros usuários".
        result = events.filter(e => {
          if (!isOthersActive(e)) return false;
          const role = (e.userRole || '').toUpperCase();
          return role === 'PARTICIPANTE' || role === 'CONVIDADO';
        });
        break;
      case 'removed': 
        result = events.filter(e => e.requestStatus === 'rejected' || e.participationStatus === 'rejected');
        break;
      case 'withdrawn':
        result = events.filter(e => e.participationStatus === 'withdrawn');
        break;
      default:
        // activeTab === null: sem filtro — mostra todos os eventos.
        result = events;
        break;
    }

    // 2. Filtro por Texto
    if (term) {
      result = result.filter(e => 
        (e.title || '').toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term) ||
        (e.location || '').toLowerCase().includes(term) ||
        (e.nature || '').toLowerCase().includes(term) ||
        (e.category || '').toLowerCase().includes(term)
      );
    }

    // 3. Ordenação Decrescente por Data de Criação
    result = [...result].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    
    return result;
  }, [events, activeTab, searchTerm]);

  const visibleEvents = useMemo(() => {
    return filteredEvents.slice(0, visibleCount);
  }, [filteredEvents, visibleCount]);

  return (
    <div className="relative max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Fundo com profundidade — os blocos da página ficam em primeiro plano */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/4 size-[420px] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-32 size-[380px] rounded-full bg-violet-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 size-[320px] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-[260px] rounded-full bg-amber-200/15 blur-3xl" />
      </div>

      {/* Header Section */}
      <header className="relative z-10 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/40 border border-indigo-100/70 px-6 md:px-8 py-7 md:py-8 shadow-[0_24px_55px_-28px_rgba(28,46,74,0.45)]">
        {/* Decoração de fundo — anéis vivos */}
        <div className="absolute -top-16 -right-16 size-48 rounded-full bg-indigo-300/30 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 size-36 rounded-full bg-violet-300/30 blur-2xl" />

        <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center size-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                <span className="material-symbols-outlined text-[20px]">dashboard</span>
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-700 via-violet-600 to-indigo-700 bg-clip-text text-transparent">
                Meu Espaço
              </h1>
            </div>
            <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-lg">
              Seu envolvimento vem de três caminhos: eventos que <strong className="text-indigo-700">você cria</strong> (nível definido pela responsabilidade pela organização), eventos em que <strong className="text-violet-600">alguém te inclui na criação</strong> (co-organizador ou participante) e eventos em que <strong className="text-cyan-600">você entra por conta própria</strong> pelo detalhamento do evento (participante).
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/create-event')}
              className="flex items-center gap-2 pl-3.5 pr-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5 active:scale-95 group"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:rotate-90 transition-transform duration-300">add</span>
              <span className="text-sm font-semibold tracking-wide">Novo</span>
            </button>

            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border ${
                showAnalytics
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-md shadow-indigo-500/25'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{showAnalytics ? 'view_list' : 'analytics'}</span>
              <span className="hidden sm:inline">{showAnalytics ? 'Lista' : 'Análises'}</span>
            </button>

            <div className="w-px h-6 bg-slate-200/80 mx-1" />

            <button
              onClick={() => refresh()}
              className="size-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
              title="Sincronizar dados"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform duration-700 group-hover:rotate-180">refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <StatsCards 
        stats={stats} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
      />

      {/* Main Content Area */}
      <div className="relative z-10 space-y-6">
        {showAnalytics ? (
          <AnalyticsSection analytics={analytics || { byType: [], byNature: [], byTime: [], byResources: [] }} />
        ) : (
          <>
            <FilterBar 
              searchTerm={searchTerm} 
              onSearchChange={setSearchTerm} 
              resultCount={filteredEvents.length}
            />
            
            <div className="space-y-4">
              <EventList 
                events={visibleEvents}
                loading={loading}
                onOpenCalendar={handleOpenEventInCalendar}
                onCancel={handleCancelEvent}
                onDelete={handleDeleteEvent}
                onDuplicate={handleDuplicateEvent}
                onEdit={handleEditEvent}
              />

              {filteredEvents.length > visibleCount && (
                <div className="relative z-10 flex justify-center pt-2">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 10)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm group"
                  >
                    <span className="material-symbols-outlined text-[20px] group-hover:translate-y-0.5 transition-transform">expand_more</span>
                    Carregar mais eventos
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {refusalModalOpen && (
        <RefusalModal
          onClose={() => {
            setRefusalModalOpen(false);
            setEventToCancel(null);
          }}
          onConfirm={handleConfirmCancellation}
          loading={processingCancellation}
          title="Cancelar Evento"
          description="Por favor, informe o motivo do cancelamento deste evento. Esta ação notificará todos os participantes."
          confirmText="Confirmar cancelamento"
        />
      )}

      <ConfirmationModal
        isOpen={confirmationModalOpen}
        onClose={() => setConfirmationModalOpen(false)}
        onConfirm={confirmationModalConfig.onConfirm}
        title={confirmationModalConfig.title}
        description={confirmationModalConfig.description}
        confirmText={confirmationModalConfig.confirmText}
        variant={confirmationModalConfig.variant}
      />
    </div>
  );
};

export default MyInvolvement;
