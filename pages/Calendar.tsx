import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { notificationService } from '../lib/notifications';

import EventDetailsModal from '../components/EventDetailsModal';
import AdvancedFilters from '../components/AdvancedFilters';
import { INVOLVEMENT_LEVELS, UNIDADES } from '../lib/constants';

const Calendar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    unidades: [] as string[],
    users: [] as string[],
    types: [] as string[],
    involvementLevels: [] as string[],
    locations: [] as string[],
    timeRange: [0, 1440] as [number, number],
  });

  // Options State
  const [filterOptions, setFilterOptions] = useState({
    unidades: UNIDADES,
    users: [] as { id: string; name: string }[],
    types: [] as { id: string; name: string }[],
    involvementLevels: INVOLVEMENT_LEVELS,
    locations: [] as { id: string; name: string }[],
  });

  // Group events by date for efficient lookup
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    // Apply Filters
    const filteredEvents = events.filter(event => {
      // Unidade Filter
      if (filters.unidades.length > 0) {
        const eventUnidades = event.unidades || [];
        if (!filters.unidades.some(u => eventUnidades.includes(u))) return false;
      }

      // User Filter (Participant/Organizer/Co-organizer)
      if (filters.users.length > 0) {
        const isCreator = filters.users.includes(event.user);
        const isParticipant = (event.participants || []).some((pId: string) => filters.users.includes(pId));
        if (!isCreator && !isParticipant) return false;
      }

      // Type Filter
      if (filters.types.length > 0) {
        if (!filters.types.includes(event.type)) return false;
      }

      // Involvement Level Filter
      if (filters.involvementLevels.length > 0) {
        // Check creator role
        const creatorRole = event.creator_role || 'PARTICIPANTE';
        const isCreatorMatch = filters.involvementLevels.includes(creatorRole) && filters.users.includes(event.user);
        
        // Check participant roles
        const participantRoles = event.participants_roles || {};
        const isParticipantMatch = (event.participants || []).some((pId: string) => 
          filters.involvementLevels.includes(participantRoles[pId]) && (filters.users.length === 0 || filters.users.includes(pId))
        );

        // If user filter is active, we check if the filtered users have the filtered roles
        // If no user filter, we check if ANY participant/creator has the filtered role
        if (filters.users.length > 0) {
          if (!isCreatorMatch && !isParticipantMatch) return false;
        } else {
          const hasAnyRoleMatch = filters.involvementLevels.includes(creatorRole) || 
            Object.values(participantRoles).some((role: any) => filters.involvementLevels.includes(role));
          if (!hasAnyRoleMatch) return false;
        }
      }

      // Location Filter
      if (filters.locations.length > 0) {
        if (!filters.locations.includes(event.location)) return false;
      }

      // Time Range Filter
      const [minMins, maxMins] = filters.timeRange;
      if (minMins !== 0 || maxMins !== 1440) {
        const startDate = new Date(event.date_start);
        const eventMins = startDate.getHours() * 60 + startDate.getMinutes();
        if (eventMins < minMins || eventMins > maxMins) return false;
      }

      return true;
    });

    filteredEvents.forEach(event => {
      const date = new Date(event.date_start || event.date);
      const key = date.toDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    return grouped;
  }, [events, filters]);
  
  // Initialize state from URL or defaults
  const [currentDate, setCurrentDate] = useState(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      // Parse YYYY-MM-DD manually to avoid timezone shifts
      const parts = dateParam.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) return d;
      }
    }
    return new Date();
  });
  
  const [viewType, setViewType] = useState<'month' | 'week' | 'day' | 'agenda'>(() => {
     const view = searchParams.get('view');
     if (view === 'month' || view === 'week' || view === 'day' || view === 'agenda') {
       return view;
     }
     return 'month';
    });
  
    // Handle browser back/forward buttons
    useEffect(() => {
      const view = searchParams.get('view');
      if (view && view !== viewType && (view === 'month' || view === 'week' || view === 'day' || view === 'agenda')) {
        setViewType(view as any);
      }
      
      const dateParam = searchParams.get('date');
      if (dateParam) {
        // Parse YYYY-MM-DD manually to avoid timezone shifts
        const parts = dateParam.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          if (!isNaN(d.getTime()) && d.toDateString() !== currentDate.toDateString()) {
            setCurrentDate(d);
          }
        }
      }
    }, [searchParams]);
  const [tooltipData, setTooltipData] = useState<{ event: any, x: number, y: number, height: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [initialChatOpen, setInitialChatOpen] = useState(false);

  // Handle openChat from URL
  useEffect(() => {
    const eventId = searchParams.get('openChat');
    if (eventId && events.length > 0) {
      const event = events.find(e => e.id === eventId);
      if (event) {
        setSelectedEvent(event);
        setInitialChatOpen(true);
        // Clean up the URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openChat');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, events]);

  const daysLabels = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  // Calculate calendar days for month view
  const getDatesForMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const dates = [];
    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      dates.push({ date: new Date(year, month - 1, prevMonthLastDay - i), type: 'prev' });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push({ date: new Date(year, month, i), type: 'current' });
    }
    // Next month padding
    const totalSlots = dates.length > 35 ? 42 : 35;
    const nextMonthPadding = totalSlots - dates.length;
    for (let i = 1; i <= nextMonthPadding; i++) {
      dates.push({ date: new Date(year, month + 1, i), type: 'next' });
    }
    return dates;
  };

  // Calculate days for week view
  const getDatesForWeek = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const isCurrentWeek = (date: Date) => {
    const today = new Date();
    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - today.getDay());
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startOfViewWeek = new Date(date);
    startOfViewWeek.setDate(date.getDate() - date.getDay());
    startOfViewWeek.setHours(0, 0, 0, 0);

    return startOfCurrentWeek.getTime() === startOfViewWeek.getTime();
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  // Fetch Filter Options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [users, types, locations] = await Promise.all([
          pb.collection('agenda_cap53_usuarios').getFullList({
            sort: 'name',
            fields: 'id,name'
          }),
          pb.collection('agenda_cap53_tipos_evento').getFullList({
            sort: 'name',
            filter: 'active = true'
          }),
          pb.collection('agenda_cap53_locais').getFullList({
            sort: 'name'
          })
        ]);

        setFilterOptions(prev => ({
          ...prev,
          users: users.map(u => ({ id: u.id, name: u.name })),
          types: types.map(t => ({ id: t.id, name: t.name })),
          locations: locations.map(l => ({ id: l.id, name: l.name }))
        }));
      } catch (error) {
        console.error('Error fetching filter options:', error);
      }
    };

    fetchFilterOptions();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Calculate date range for the current month (with padding for month view)
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Get first day of current month's calendar (including prev month padding)
      const firstDayOfMonth = new Date(year, month, 1);
      const startRange = new Date(year, month, 1 - firstDayOfMonth.getDay());
      startRange.setHours(0, 0, 0, 0);
      
      // Get last day of current month's calendar (including next month padding)
      const endRange = new Date(year, month + 1, 0);
      endRange.setDate(endRange.getDate() + (42 - (firstDayOfMonth.getDay() + endRange.getDate())));
      endRange.setHours(23, 59, 59, 999);

      const filter = `date_start >= "${startRange.toISOString().replace('T', ' ')}" && date_start <= "${endRange.toISOString().replace('T', ' ')}"`;

      const res = await pb.collection('agenda_cap53_eventos').getFullList({
        filter,
        expand: 'user,location,participants',
        fields: 'id,title,type,description,observacoes,date_start,date_end,location,custom_location,user,participants,participants_roles,creator_role,status,almoxarifado_items,copa_items,informatica_items,transporte,transporte_suporte,transporte_origem,transporte_destino,transporte_horario_levar,transporte_horario_buscar,transporte_obs,unidades,categorias_profissionais,transporte_status,transporte_justification,participants_status,cancel_reason,almoxarifado_confirmed_items,copa_confirmed_items,informatica_confirmed_items,is_restricted,expand',
        requestKey: null
      });
      console.log('Eventos carregados:', res.length);
      setEvents(res);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEvent = async (eventId: string, title: string, participants: string[]) => {
    const reason = prompt('Por que deseja cancelar este evento?');
    if (reason === null) return;

    try {
      await pb.collection('agenda_cap53_eventos').update(eventId, {
        status: 'cancelled',
        cancel_reason: reason
      });

      // Notify participants
      if (participants && participants.length > 0) {
        await Promise.all(participants.map(pId =>
          pb.collection('agenda_cap53_notifications').create({
            user: pId,
            title: 'Evento Cancelado',
            message: `O evento "${title}" foi cancelado. Motivo: ${reason}`,
            type: 'cancellation',
            read: false
          })
        ));
      }

      alert('Evento cancelado com sucesso.');
      fetchEvents();
    } catch (error) {
      console.error('Error cancelling event:', error);
      alert('Erro ao cancelar evento.');
    }
  };

  const handleDeleteEvent = async (event: any) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o evento "${event.title}"?`)) return;

    try {
        const notifications = [];
        const recipients = new Set<string>();
        
        // 1. Add Participants
        if (event.participants && event.participants.length > 0) {
            event.participants.forEach((p: string) => recipients.add(p));
        }

        // 2. Check ALMC involvement (Requests or Items)
        const almacRequests = await pb.collection('agenda_cap53_almac_requests').getList(1, 1, {
            filter: `event = "${event.id}"`
        });
        
        const isAlmcInvolved = almacRequests.totalItems > 0 || (event.almoxarifado_items && event.almoxarifado_items.length > 0) || (event.copa_items && event.copa_items.length > 0);
        
        if (isAlmcInvolved) {
             const almcUsers = await pb.collection('agenda_cap53_usuarios').getFullList({ filter: 'role = "ALMC"' });
             almcUsers.forEach(u => recipients.add(u.id));
        }

        // 3. Check TRA involvement
        if (event.transporte_suporte) {
             const traUsers = await pb.collection('agenda_cap53_usuarios').getFullList({ filter: 'role = "TRA"' });
             traUsers.forEach(u => recipients.add(u.id));
        }

        // 4. Check CE/Location involvement
        if (event.location || event.expand?.location) {
             const ceUsers = await pb.collection('agenda_cap53_usuarios').getFullList({ filter: 'role = "CE"' });
             ceUsers.forEach(u => recipients.add(u.id));
        }

        // Remove the creator from recipients (no need to notify themselves about their own action)
        if (user?.id) recipients.delete(user.id);

        // Create notifications (NOT linked to the event to avoid cascade delete)
        const timestamp = new Date().toLocaleString('pt-BR');
        const notifPromises = Array.from(recipients).map(recipientId => 
            pb.collection('agenda_cap53_notifications').create({
                user: recipientId,
                title: 'Evento Excluído',
                message: `O evento "${event.title}" foi excluído pelo criador em ${timestamp}.`,
                type: 'event_deleted',
                read: false,
                data: {
                    deleted_by: user.id,
                    deleted_by_name: user.name || user.email,
                    deleted_at: new Date().toISOString()
                }
                // event: event.id // DO NOT LINK to avoid cascade delete
            })
        );
        
        await Promise.all(notifPromises);

        // Delete the event
        await pb.collection('agenda_cap53_eventos').delete(event.id);

        alert('Evento excluído com sucesso.');
        setSelectedEvent(null);
        fetchEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        alert('Erro ao excluir evento.');
    }
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleDayDoubleClick = (date: Date) => {
    // Use local date components to avoid timezone shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    navigate(`/create-event?date=${dateStr}`);
  };

  const updateURL = (newView: string, newDate: Date, replace = false) => {
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    setSearchParams({ view: newView, date: dateStr }, { replace });
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewType === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
    updateURL(viewType, newDate, true); // Replace for simple navigation
  };

  return (
    <div className="flex h-full gap-3 max-w-[1700px] mx-auto overflow-hidden relative">
      <div className="flex-1 flex flex-col h-full gap-3 overflow-hidden">
        {/* Filters Bar - Fixed Top */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-border-light shadow-sm sticky top-0 z-30 transition-all duration-300">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const today = new Date();
                setCurrentDate(today);
                updateURL(viewType, today, true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-lg transition-all duration-300 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">today</span>
              Hoje
            </button>

            <div className="flex items-center bg-white rounded-lg p-1 border border-border-light">
              <button
                onClick={() => handleNavigate('prev')}
                className="size-8 flex items-center justify-center rounded hover:bg-primary hover:text-white text-text-main transition-all duration-300 shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <span className="px-4 text-sm font-bold text-text-main min-w-[180px] text-center capitalize">
                {viewType === 'day'
                  ? currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  : currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => handleNavigate('next')}
                className="size-8 flex items-center justify-center rounded hover:bg-primary hover:text-white text-text-main transition-all duration-300 shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white p-1 rounded-lg border border-border-light">
              <button
                onClick={() => updateURL('day', currentDate)}
                className={`px-4 py-1.5 text-sm font-medium rounded transition-all duration-300 ${viewType === 'day' ? 'bg-primary text-white shadow-sm border border-primary/20 font-bold' : 'text-text-secondary hover:text-text-main hover:bg-primary/[0.02]'}`}
              >
                Dia
              </button>
              <button
                onClick={() => updateURL('week', currentDate)}
                className={`px-4 py-1.5 text-sm font-medium rounded transition-all duration-300 ${viewType === 'week' ? 'bg-primary text-white shadow-sm border border-primary/20 font-bold' : 'text-text-secondary hover:text-text-main hover:bg-primary/[0.02]'}`}
              >
                Semana
              </button>
              <button
                onClick={() => updateURL('month', currentDate)}
                className={`px-4 py-1.5 text-sm font-medium rounded transition-all duration-300 ${viewType === 'month' ? 'bg-primary text-white shadow-sm border border-primary/20 font-bold' : 'text-text-secondary hover:text-text-main hover:bg-primary/[0.02]'}`}
              >
                Mês
              </button>
              <button
                onClick={() => updateURL('agenda', currentDate)}
                className={`px-4 py-1.5 text-sm font-medium rounded transition-all duration-300 ${viewType === 'agenda' ? 'bg-primary text-white shadow-sm border border-primary/20 font-bold' : 'text-text-secondary hover:text-text-main hover:bg-primary/[0.02]'}`}
              >
                Agenda
              </button>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg border transition-all duration-300 ${showAdvancedFilters ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-text-secondary border-border-light hover:border-primary/30 hover:bg-primary/[0.02]'}`}
            >
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
              <span className="hidden sm:inline">Filtros</span>
              {Object.values(filters).some(f => f.length > 0) && (
                <span className="flex items-center justify-center size-5 bg-white text-primary text-[10px] rounded-full font-black">
                  {Object.values(filters).reduce((a, b) => a + b.length, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {Object.entries(filters).some(([k, v]) => k === 'timeRange' ? (v as [number, number])[0] !== 0 || (v as [number, number])[1] !== 1440 : (v as any[]).length > 0) && (
          <div className="flex flex-wrap gap-2 pb-1">
            {Object.entries(filters).map(([category, values]) => {
              if (category === 'timeRange') {
                const [min, max] = values as [number, number];
                if (min === 0 && max === 1440) return null;
                const formatTime = (mins: number) => {
                  const h = Math.floor(mins / 60).toString().padStart(2, '0');
                  const m = (mins % 60).toString().padStart(2, '0');
                  return `${h}:${m}`;
                };
                return (
                  <div 
                    key="timeRange-chip"
                    className="flex items-center gap-1.5 px-3 py-1 bg-white border border-primary/20 rounded-full text-[11px] font-bold text-primary shadow-sm"
                  >
                    <span>{formatTime(min)} - {formatTime(max)}</span>
                    <button 
                      onClick={() => setFilters(prev => ({ ...prev, timeRange: [0, 1440] }))}
                      className="hover:text-primary-active transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                );
              }
              
              return (values as string[]).map((value) => {
                let label = value;
                if (category === 'users') label = filterOptions.users.find(u => u.id === value)?.name || value;
                if (category === 'types') label = filterOptions.types.find(t => t.id === value)?.name || value;
                if (category === 'locations') label = filterOptions.locations.find(l => l.id === value)?.name || value;
                if (category === 'involvementLevels') label = filterOptions.involvementLevels.find(l => l.value === value)?.label || value;
                
                return (
                  <div 
                    key={`${category}-${value}`}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white border border-primary/20 rounded-full text-[11px] font-bold text-primary shadow-sm"
                  >
                    <span className="max-w-[150px] truncate">{label}</span>
                    <button 
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          [category]: (prev[category as keyof typeof filters] as string[]).filter(v => v !== value)
                        }));
                      }}
                      className="hover:text-primary-active transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                );
              });
            })}
            <button 
              onClick={() => setFilters({
                unidades: [],
                users: [],
                types: [],
                involvementLevels: [],
                locations: [],
                timeRange: [0, 1440],
              })}
              className="text-[11px] font-bold text-text-secondary hover:text-primary transition-colors px-2 py-1"
            >
              Limpar tudo
            </button>
          </div>
        )}

        {/* Calendar Grid Container */}
        <div className="bg-white rounded-xl border border-border-light shadow-sm flex-1 flex flex-col overflow-hidden min-h-[400px]">
        {viewType === 'month' && (
          <>
            <div className="grid grid-cols-7 border-b border-border-light bg-white sticky top-0 z-10">
              {daysLabels.map((day) => (
                <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-text-secondary">
                  {day}
                </div>
              ))}
            </div>
            <div className={`grid grid-cols-7 flex-1 divide-x divide-y divide-border-light border-l border-border-light bg-white ${getDatesForMonth(currentDate).length > 35 ? 'grid-rows-6' : 'grid-rows-5'
              }`}>
              {getDatesForMonth(currentDate).map((dateObj, idx) => {
                const dateKey = dateObj.date.toDateString();
                const dayEvents = eventsByDate[dateKey] || [];
                const isToday = dateObj.date.toDateString() === new Date().toDateString();
                const isSelected = selectedDate?.toDateString() === dateObj.date.toDateString();

                return (
                  <div
                    key={idx}
                    onDoubleClick={() => handleDayDoubleClick(dateObj.date)}
                    className={`flex flex-col p-2 relative group transition-all duration-300 cursor-default ${dateObj.type === 'current' 
                      ? (isToday ? 'bg-primary/[0.03]' : 'bg-white hover:bg-primary/[0.05]') 
                      : 'bg-slate-100/80 text-text-secondary/60'
                    } ${isToday ? 'ring-1 ring-inset ring-primary/20' : 'border-slate-100'} ${
                      dateObj.type === 'current' ? 'shadow-sm' : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateURL('day', dateObj.date);
                      }}
                      className={`text-xs font-bold self-end mb-1 size-6 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${isToday ? 'bg-primary text-white rounded-full shadow-md' : (dateObj.type === 'current' ? 'text-text-main group-hover:text-primary' : 'text-text-secondary/40')
                        }`}
                    >
                      {dateObj.date.getDate()}
                    </button>

                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100%-1.5rem)] custom-scrollbar pr-1">
                      {dayEvents.map(event => (
                        <CalendarEventCard
                          key={event.id}
                          event={event}
                          user={user}
                          onCancel={handleCancelEvent}
                          setTooltipData={setTooltipData}
                          onSelect={setSelectedEvent}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {viewType === 'week' && (
          <div className={`flex-1 flex flex-col h-full overflow-hidden ${isCurrentWeek(currentDate) ? 'bg-white' : 'bg-slate-100/30'}`}>
            <div className={`grid grid-cols-7 border-b border-border-light bg-white ${isCurrentWeek(currentDate) ? '' : 'ring-1 ring-inset ring-slate-200 shadow-sm'}`}>
              {getDatesForWeek(currentDate).map((date, idx) => (
                <div key={idx} className={`py-4 flex flex-col items-center gap-1 border-r border-border-light last:border-r-0 transition-all duration-300 ${date.toDateString() === new Date().toDateString() ? 'bg-primary/[0.05] border-t-2 border-primary' : (isCurrentWeek(currentDate) ? '' : 'bg-slate-50/50')
                  }`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${date.toDateString() === new Date().toDateString() ? 'text-primary' : 'text-text-secondary'}`}>{daysLabels[idx]}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateURL('day', date);
                    }}
                    className={`text-lg font-black transition-all duration-300 hover:scale-110 active:scale-95 ${date.toDateString() === new Date().toDateString() ? 'text-primary' : 'text-text-main hover:text-primary'}`}
                  >
                    {date.getDate()}
                  </button>
                </div>
              ))}
            </div>
            <div className={`grid grid-cols-7 flex-1 divide-x divide-border-light bg-white overflow-y-auto custom-scrollbar ${isCurrentWeek(currentDate) ? '' : 'bg-slate-50/20'}`}>
              {getDatesForWeek(currentDate).map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const dayEvents = eventsByDate[date.toDateString()] || [];
                return (
                  <div
                      key={idx}
                      onDoubleClick={() => handleDayDoubleClick(date)}
                      className={`flex flex-col p-3 gap-2 min-h-[500px] cursor-default transition-all duration-300 ${
                        isToday ? 'bg-primary/[0.02]' : (isCurrentWeek(currentDate) ? 'hover:bg-primary/[0.03]' : 'bg-slate-100/50 hover:bg-slate-100/80')
                      } ${!isCurrentWeek(currentDate) ? 'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]' : ''}`}
                    >
                      {dayEvents.map(event => (
                      <CalendarEventCard
                        key={event.id}
                        event={event}
                        user={user}
                        onCancel={handleCancelEvent}
                        setTooltipData={setTooltipData}
                        onSelect={setSelectedEvent}
                      />
                    ))}
                    {dayEvents.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-20 py-20 grayscale">
                        <span className="material-symbols-outlined text-4xl">event_busy</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewType === 'day' && (
          <div 
            onDoubleClick={() => handleDayDoubleClick(currentDate)}
            className="flex-1 flex flex-col p-4 bg-white overflow-y-auto custom-scrollbar cursor-default"
            title="Clique duplo para novo evento"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 transition-all duration-300">
                <div className="size-12 rounded-xl bg-primary text-white flex items-center justify-center border border-primary/20 shadow-md transition-all duration-300 hover:scale-105">
                  <span className="text-xl font-black">{currentDate.getDate()}</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="text-xl font-black text-text-main capitalize">
                    {currentDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </h3>
                  <p className="text-[11px] text-text-secondary font-medium">
                    {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {(() => {
                const dayEvents = eventsByDate[currentDate.toDateString()] || [];
                return dayEvents.map(event => (
                  <div key={event.id} className="max-w-2xl">
                    <CalendarEventCard
                      event={event}
                      user={user}
                      onCancel={handleCancelEvent}
                      detailed
                      setTooltipData={setTooltipData}
                      onSelect={setSelectedEvent}
                    />
                  </div>
                ));
              })()}
              {(eventsByDate[currentDate.toDateString()] || []).length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-text-secondary/40">
                  <span className="material-symbols-outlined text-6xl mb-4">calendar_today</span>
                  <p className="text-lg font-bold">Nenhum evento agendado para este dia.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewType === 'agenda' && (
          <div className="flex-1 flex flex-col p-6 bg-white overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 mb-6">
               <span className="material-symbols-outlined text-primary text-3xl">view_agenda</span>
               <h3 className="text-xl font-black text-text-main">Agenda do Mês</h3>
            </div>
            
            <div className="flex flex-col gap-8">
              {(() => {
                 // Filter events for the current month and year
                 const monthEvents = events.filter(e => {
                    const eDate = new Date(e.date_start || e.date);
                    return eDate.getMonth() === currentDate.getMonth() &&
                           eDate.getFullYear() === currentDate.getFullYear();
                 }).sort((a, b) => new Date(a.date_start || a.date).getTime() - new Date(b.date_start || b.date).getTime());

                 if (monthEvents.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 text-text-secondary/40">
                          <span className="material-symbols-outlined text-6xl mb-4">event_note</span>
                          <p className="text-lg font-bold">Nenhum evento agendado para este mês.</p>
                        </div>
                    );
                 }

                 // Group the filtered and sorted events by date
                 const groupedEventsByDate: { [key: string]: any[] } = {};
                 monthEvents.forEach(event => {
                    const dateKey = new Date(event.date_start || event.date).toDateString();
                    if (!groupedEventsByDate[dateKey]) groupedEventsByDate[dateKey] = [];
                    groupedEventsByDate[dateKey].push(event);
                 });

                 return Object.entries(groupedEventsByDate).map(([dateStr, dayEvents]) => {
                    const date = new Date(dayEvents[0].date_start || dayEvents[0].date);
                    const isToday = new Date().toDateString() === date.toDateString();
                    
                    return (
                        <div key={dateStr} className={`flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isToday ? 'bg-primary/[0.01] -mx-2 px-2 py-4 rounded-2xl ring-1 ring-primary/5' : 'opacity-80'}`}>
                            <div className={`flex items-center gap-3 pb-2 border-b border-border-light ${isToday ? 'text-primary' : 'text-text-secondary'}`}>
                                <span className={`text-3xl font-black ${isToday ? 'text-primary' : 'text-text-main opacity-70'}`}>{date.getDate()}</span>
                                <div className="flex flex-col leading-tight">
                                    <span className="text-sm font-bold uppercase tracking-wider">{date.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
                                    <span className="text-xs font-medium opacity-70">{date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                                </div>
                                {isToday && <span className="ml-auto text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest">Hoje</span>}
                            </div>
                            <div className="pl-4 md:pl-12 flex flex-col gap-3">
                                {dayEvents.map(event => (
                                    <div key={event.id} className="max-w-4xl hover:translate-x-1 transition-transform duration-200">
                                        <CalendarEventCard
                                            event={event}
                                            user={user}
                                            onCancel={handleCancelEvent}
                                            detailed
                                            setTooltipData={setTooltipData}
                                            onSelect={setSelectedEvent}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                 });
              })()}
            </div>
          </div>
        )}
      </div>

      <CalendarTooltip
        event={tooltipData?.event}
        visible={!!tooltipData}
        x={tooltipData?.x || 0}
        y={tooltipData?.y || 0}
        height={tooltipData?.height || 0}
      />

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => {
            setSelectedEvent(null);
            setInitialChatOpen(false);
          }}
          onCancel={handleCancelEvent}
          onDelete={handleDeleteEvent}
          user={user}
          initialChatOpen={initialChatOpen}
        />
      )}

      <AdvancedFilters
        isOpen={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        filters={filters}
        setFilters={setFilters}
        options={filterOptions}
      />
    </div>
  </div>
);
};

const CalendarTooltip: React.FC<{ event: any, visible: boolean, x: number, y: number, height: number }> = ({ event: propEvent, visible, x, y, height }) => {
  const [requests, setRequests] = React.useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const [isRendered, setIsRendered] = React.useState(false);
  const [opacity, setOpacity] = React.useState(0);
  const [event, setEvent] = React.useState<any>(null);

  // Sync internal event state with propEvent, but keep it while fading out
  React.useEffect(() => {
    if (visible && propEvent) {
      setEvent(propEvent);
      setIsRendered(true);
      const timer = setTimeout(() => setOpacity(1), 10);
      return () => clearTimeout(timer);
    } else {
      setOpacity(0);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setEvent(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [visible, propEvent]);

  // Fetch requests for the event
  React.useEffect(() => {
    if (visible && event?.id) {
      setLoadingRequests(true);
      pb.collection('agenda_cap53_almac_requests').getFullList({
        filter: `event = "${event.id}"`,
        expand: 'item'
      })
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoadingRequests(false));
    } else if (!visible) {
      setRequests([]);
    }
  }, [visible, event?.id]);

  React.useLayoutEffect(() => {
    if (isRendered && tooltipRef.current && event) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      let left = x - tooltipRect.width / 2;
      let top = y - tooltipRect.height - 10;

      // Define safe horizontal bounds (avoiding sidebars on lg screens)
      let minLeft = 10;
      let maxRight = windowWidth - 10;

      if (windowWidth >= 1024) { // lg breakpoint
        minLeft = 256 + 10; // Sidebar width (w-64 = 256px) + margin
        maxRight = windowWidth - 288 - 10; // RightSidebar width (w-72 = 288px) + margin
      }

      // Horizontal adjustments within safe area
      if (left < minLeft) {
        left = minLeft;
      } else if (left + tooltipRect.width > maxRight) {
        left = maxRight - tooltipRect.width;
      }

      // Vertical adjustments
      if (top < 10) {
        top = y + height + 10;
        if (top + tooltipRect.height > windowHeight - 10) {
           top = Math.max(10, windowHeight - tooltipRect.height - 10);
        }
      }

      setPosition({ 
        top: top + scrollY, 
        left: left + scrollX 
      });
    }
  }, [isRendered, x, y, height, requests, event]);

  if (!isRendered || !event) return null;

  const startDate = new Date(event.date_start || event.date);
  const endDate = new Date(event.date_end || event.date_start || event.date);
  const creatorInitial = (event.expand?.user?.name || 'S')[0].toUpperCase();

  // Helper to determine status for Almc/Copa
  const almcStatus = event.almoxarifado_items?.length > 0 
    ? (event.almoxarifado_confirmed_items?.length === event.almoxarifado_items.length ? 'confirmed' : 'pending') 
    : null;
    
  const copaStatus = event.copa_items?.length > 0 
    ? (event.copa_confirmed_items?.length === event.copa_items.length ? 'confirmed' : 'pending') 
    : null;

  const pStatus = event.participants_status || {};
  const pRoles = event.participants_roles || {};

  // Contagem por papel (apenas confirmados)
  const roleBreakdown: Record<string, number> = {};
  let totalConfirmed = 0;

  const addRoleToBreakdown = (userId: string, roleValue: string) => {
    let label = '';
    if (userId === event.user) {
      label = 'Criador e Participante';
    } else {
      const level = INVOLVEMENT_LEVELS.find(l => l.value === roleValue.toUpperCase());
      label = level ? level.label : 'Participante';
    }
    roleBreakdown[label] = (roleBreakdown[label] || 0) + 1;
  };

  Object.entries(pStatus).forEach(([userId, status]) => {
    if (status === 'accepted') {
      totalConfirmed++;
      const role = pRoles[userId] || 'PARTICIPANTE';
      addRoleToBreakdown(userId, role);
    }
  });

  // Se o criador não estiver na lista de participantes confirmados, 
  // mas quisermos considerá-lo (geralmente o criador é o organizador padrão)
  if (event.user && !pStatus[event.user]) {
    totalConfirmed++;
    addRoleToBreakdown(event.user, event.creator_role || 'ORGANIZADOR');
  }

  const getStatusStyle = (status: string) => {
    return status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100';
  };

  const getStatusLabel = (status: string) => {
    return status === 'confirmed' ? 'Confirmado' : 'Pendente';
  };

  return createPortal(
    <div
      ref={tooltipRef}
      style={{ 
        left: `${position.left}px`, 
        top: `${position.top}px`,
        opacity: opacity,
        transform: `scale(${0.95 + (opacity * 0.05)}) translateY(${(1 - opacity) * 10}px)`,
        transition: 'opacity 200ms ease-out, transform 200ms ease-out'
      }}
      className="absolute z-[10000] w-[280px] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-gray-100/50 overflow-hidden pointer-events-none"
    >
      <div className="p-4 space-y-3">
        {/* Header Section */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-col min-w-0">
            <h4 className="text-base font-black text-primary leading-tight truncate">
              {event.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary/60 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                {event.type || 'Evento'}
              </span>
              {event.status === 'cancelled' && (
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 uppercase tracking-wider">Cancelado</span>
              )}
            </div>
          </div>
          <div className="size-8 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center text-primary font-black text-xs shadow-sm shrink-0">
            {creatorInitial}
          </div>
        </div>

        {/* Time and Date */}
        <div className="flex items-center gap-2.5 py-2 px-3 bg-primary/[0.03] rounded-xl border border-primary/5">
          <span className="material-symbols-outlined text-lg text-primary opacity-70">schedule</span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-bold text-text-main">
              De {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} às {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
            <span className="text-[10px] font-medium text-text-secondary capitalize">
              {startDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Essential Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 px-1">
            <span className="material-symbols-outlined text-base text-slate-400">location_on</span>
            <span className="text-[11px] font-bold text-text-main truncate">
              {event.expand?.location?.name || event.custom_location || 'Local não definido'}
            </span>
          </div>
          
          <div className="flex items-center gap-2.5 px-1">
            <span className="material-symbols-outlined text-base text-slate-400">groups</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-text-main">
                {totalConfirmed} {totalConfirmed === 1 ? 'Participante' : 'Participantes'}
              </span>
              {totalConfirmed > 0 && (
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                  {Object.entries(roleBreakdown).map(([label, count]) => (
                    <span key={label} className="text-[9px] text-text-secondary font-medium whitespace-nowrap">
                      {count} {label.toLowerCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Minimal Status Indicators */}
        {(event.transporte_suporte || almcStatus || copaStatus) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {event.transporte_suporte && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider ${
                event.transporte_status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-100' : 
                event.transporte_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                'bg-yellow-50 text-yellow-700 border-yellow-100'
              }`}>
                <span className="material-symbols-outlined text-[12px]">directions_car</span>
                {event.transporte_status === 'confirmed' ? 'Carro OK' : 
                 event.transporte_status === 'rejected' ? 'Carro Rec' : 
                 'Carro Pend'}
              </div>
            )}
            {almcStatus && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider ${getStatusStyle(almcStatus)}`}>
                <span className="material-symbols-outlined text-[12px]">inventory_2</span>
                Almc {getStatusLabel(almcStatus)}
              </div>
            )}
            {copaStatus && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider ${getStatusStyle(copaStatus)}`}>
                <span className="material-symbols-outlined text-[12px]">restaurant</span>
                Copa {getStatusLabel(copaStatus)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

const CalendarEventCard: React.FC<{
  event: any,
  user: any,
  onCancel: any,
  setTooltipData: (data: { event: any, x: number, y: number, height: number } | null) => void,
  detailed?: boolean,
  onSelect: (event: any) => void
}> = ({ event, user, onCancel, setTooltipData, detailed, onSelect }) => {
  const isCancelled = event.status === 'cancelled';
  
  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Passamos as coordenadas relativas ao viewport
    setTooltipData({
      event,
      x: rect.left + rect.width / 2,
      y: rect.top,
      height: rect.height
    });
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipData(null)}
      onClick={(e) => {
        e.stopPropagation();
        setTooltipData(null);
        onSelect(event);
      }}
      className={`w-full border-l-4 rounded-r px-2 py-1.5 cursor-pointer shadow-sm transition-all duration-300 hover:translate-x-1 relative ${isCancelled
        ? 'bg-white border-border-light opacity-60'
        : 'bg-primary/[0.04] border-primary hover:bg-primary/[0.08]'
        } ${detailed ? 'p-4' : ''}`}
      title={detailed ? (isCancelled ? `Cancelado: ${event.cancel_reason}` : event.title) : undefined}
    >

      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <p className={`text-[10px] font-black leading-tight transition-colors duration-300 ${detailed ? 'text-sm' : ''} ${isCancelled ? 'text-text-secondary line-through' : 'text-primary'}`}>
          {event.title}
        </p>
        {!detailed && <span className="text-[9px] font-bold text-primary/60 whitespace-nowrap transition-colors duration-300">
          {new Date(event.date_start || event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>}
      </div>

      {detailed && (
        <div className="flex items-center gap-4 mt-2 text-xs font-medium text-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {new Date(event.date_start || event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">location_on</span>
            {event.expand?.location?.name || event.custom_location || 'Local não definido'}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">person</span>
            Criado por: {event.expand?.user?.name || 'Sistema'}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 mt-1.5">
        {event.almoxarifado_items?.length > 0 && (
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${event.almoxarifado_confirmed_items?.length === event.almoxarifado_items.length
            ? 'bg-green-100 border-green-200 text-green-700'
            : 'bg-yellow-100 border-yellow-200 text-yellow-700'
            }`} title="Almoxarifado">ALMC</span>
        )}
        {event.copa_items?.length > 0 && (
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${event.copa_confirmed_items?.length === event.copa_items.length
            ? 'bg-orange-100 border-orange-200 text-orange-700'
            : 'bg-yellow-100 border-yellow-200 text-yellow-700'
            }`} title="Copa">COPA</span>
        )}
        {event.transporte_suporte && (
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${event.transporte_status === 'confirmed' ? 'bg-green-100 border-green-200 text-green-700' :
            event.transporte_status === 'rejected' ? 'bg-red-100 border-red-200 text-red-700' :
              'bg-yellow-100 border-yellow-200 text-yellow-700'
            }`} title="Transporte">TRA</span>
        )}
        {isCancelled && <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-100 border border-red-200 text-red-700 uppercase">CANCELADO</span>}
      </div>
    </div>
  );
};

export default Calendar;
