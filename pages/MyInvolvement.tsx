import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMySpace, MySpaceEvent } from '../hooks/useMySpace';
import { useAuth } from '../components/AuthContext';
import { deleteEventWithCleanup } from '../lib/eventUtils';
import { notifyEventStatusChange, EventData } from '../lib/notificationUtils';
import { pb } from '../lib/pocketbase';

// Novos componentes modularizados
import { StatsCards } from '../components/MySpace/StatsCards';
import { EventList } from '../components/MySpace/EventList';
import { FilterBar } from '../components/MySpace/FilterBar';
import { AnalyticsSection } from '../components/MySpace/AnalyticsSection';

const MyInvolvement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Data hooks
  const { events, loading, stats, analytics, refresh } = useMySpace();
  
  // Local state
  const [activeTab, setActiveTab] = useState<'all' | 'organizer' | 'coorganizer' | 'participant' | 'pending' | 'rejected'>('all');
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  // Inicializa busca com parâmetro da URL se existir, mas gerencia localmente
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('search') || '';
  });

  // Novos Filtros
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);

  // Carregar opções de filtro
  React.useEffect(() => {
    const fetchOptions = async () => {
      try {
        const types = await pb.collection('agenda_cap53_tipos_evento').getFullList({ sort: 'name' });
        setAvailableTypes(types.map((t: any) => t.name));

        const locs = await pb.collection('agenda_cap53_locais').getFullList({ sort: 'name' });
        setAvailableLocations(locs.map((l: any) => l.name));
      } catch (error) {
        console.error('Error fetching filter options:', error);
      }
    };
    fetchOptions();
  }, []);

  // Handlers
  const handleCancelEvent = async (event: MySpaceEvent) => {
    const reason = prompt('Por que deseja cancelar este evento?');
    if (reason === null) return;

    try {
      // 1. Atualizar status
      await pb.collection('agenda_cap53_eventos').update(event.id, {
        status: 'cancelled',
        cancel_reason: reason
      });

      // 2. Notificar envolvidos
      try {
        const updatedEvent = await pb.collection('agenda_cap53_eventos').getOne(event.id);
        if (user) {
          await notifyEventStatusChange(updatedEvent as unknown as EventData, 'cancelled', reason, user.id);
        }
      } catch (notifErr) {
        console.error('Erro ao enviar notificações de cancelamento:', notifErr);
      }

      alert('Evento cancelado com sucesso.');
      refresh();
    } catch (error) {
      console.error('Error cancelling event:', error);
      alert('Erro ao cancelar evento.');
    }
  };

  const handleDeleteEvent = async (event: MySpaceEvent) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o evento "${event.title}"?`)) return;

    try {
        await deleteEventWithCleanup(event.id, user?.id);
        
        alert('Evento excluído com sucesso.');
        refresh();
    } catch (error: any) {
        console.error('Error deleting event:', error);
        const msg = error.data?.message || error.message || 'Erro desconhecido';
        alert(`Erro ao excluir evento: ${msg}`);
    }
  };

  const handleOpenEventInCalendar = (event: MySpaceEvent) => {
    const eventDate = new Date(event.date_start);
    const dateStr = eventDate.toISOString().split('T')[0];
    navigate(`/calendar?date=${dateStr}&view=agenda&eventId=${event.id}&tab=details`);
  };

  const handleDuplicateEvent = (event: MySpaceEvent) => {
    navigate(`/create-event?duplicate_from=${event.id}`);
  };

  // Filtragem
  const filteredEvents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    
    let result = events;

    // 1. Filtro por Tab (Status/Papel)
    switch (activeTab) {
      case 'organizer': 
        result = events.filter(e => (e.userRole || '').toUpperCase() === 'ORGANIZADOR' && e.requestStatus !== 'pending' && e.participationStatus !== 'pending' && e.requestStatus !== 'rejected' && e.participationStatus !== 'rejected');
        break;
      case 'coorganizer': 
        result = events.filter(e => (e.userRole || '').toUpperCase() === 'COORGANIZADOR' && e.requestStatus !== 'pending' && e.participationStatus !== 'pending' && e.requestStatus !== 'rejected' && e.participationStatus !== 'rejected');
        break;
      case 'participant': 
        result = events.filter(e => (e.userRole || '').toUpperCase() === 'PARTICIPANTE' && e.requestStatus !== 'pending' && e.participationStatus !== 'pending' && e.requestStatus !== 'rejected' && e.participationStatus !== 'rejected');
        break;
      case 'pending': 
        result = events.filter(e => e.requestStatus === 'pending' || e.participationStatus === 'pending');
        break;
      case 'rejected': 
        result = events.filter(e => e.requestStatus === 'rejected' || e.participationStatus === 'rejected');
        break;
      default: 
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

    // 3. Novos Filtros Avançados
    result = result.filter(e => {
        // Data
        if (selectedMonth !== 'all' || selectedYear !== 'all') {
            const eventDate = new Date(e.date_start);
            if (selectedMonth !== 'all' && eventDate.getMonth().toString() !== selectedMonth) return false;
            if (selectedYear !== 'all' && eventDate.getFullYear().toString() !== selectedYear) return false;
        }

        // Tipo
        if (selectedType !== 'all') {
            const type = e.category || e.nature;
            if (type !== selectedType) return false;
        }

        // Localização
        if (selectedLocation !== 'all') {
             const locName = e.expand?.location?.name || e.custom_location || e.location || '';
             if (locName !== selectedLocation) return false;
        }
        
        return true;
    });
    
    return result;
  }, [events, activeTab, searchTerm, selectedMonth, selectedYear, selectedType, selectedLocation]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Header Section */}
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="space-y-2">
           <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
             Meu Espaço
           </h1>
           <p className="text-slate-500 font-medium max-w-xl">
             Gerencie suas atividades, acompanhe solicitações e visualize seu impacto na agenda.
           </p>
        </div>

        {/* Action Controls */}
        <div className="w-full xl:w-auto flex items-center justify-center p-1.5 gap-2 bg-white rounded-full border border-slate-200 shadow-sm">
          <button 
            onClick={() => navigate('/create-event')}
            className="flex items-center gap-2 pl-3 pr-5 py-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group"
          >
            <div className="flex items-center justify-center size-6 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
                <span className="material-symbols-outlined text-sm font-bold">add</span>
            </div>
            <span className="text-sm font-semibold tracking-wide">Novo</span>
          </button>

          <button 
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              showAnalytics 
                ? 'bg-slate-100 text-slate-900' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{showAnalytics ? 'view_list' : 'analytics'}</span>
            <span className="hidden sm:inline">{showAnalytics ? 'Lista' : 'Análises'}</span>
          </button>
          
          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button 
            onClick={() => refresh()}
            className="size-10 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors group"
            title="Sincronizar dados"
          >
            <span className="material-symbols-outlined text-[22px] transition-transform duration-700 group-hover:rotate-180">refresh</span>
          </button>
        </div>
      </header>

      {/* Stats Overview */}
      <StatsCards 
        stats={stats} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* Main Content Area */}
      <div className="space-y-6">
        {showAnalytics ? (
          <AnalyticsSection analytics={analytics || { byType: [], byNature: [], byTime: [], byResources: [] }} />
        ) : (
          <>
            <FilterBar 
              searchTerm={searchTerm} 
              onSearchChange={setSearchTerm} 
              resultCount={filteredEvents.length}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              eventTypes={availableTypes}
              locations={availableLocations}
            />
            
            <EventList 
              events={filteredEvents}
              loading={loading}
              onOpenCalendar={handleOpenEventInCalendar}
              onCancel={handleCancelEvent}
              onDelete={handleDeleteEvent}
              onDuplicate={handleDuplicateEvent}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default MyInvolvement;
