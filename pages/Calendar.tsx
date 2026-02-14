import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { notificationService } from '../lib/notifications';

import EventDetailsModal from '../components/EventDetailsModal';
import { INVOLVEMENT_LEVELS } from '../lib/constants';

const Calendar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Group events by date for efficient lookup
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    events.forEach(event => {
      const date = new Date(event.date_start || event.date);
      const key = date.toDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    return grouped;
  }, [events]);
  
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
  const todayRef = useRef<HTMLDivElement>(null);

  // Function to scroll to today on mobile
  const scrollToToday = () => {
    setTimeout(() => {
      if (todayRef.current) {
        todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

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

  useEffect(() => {
    if (currentDate.toDateString() === new Date().toDateString()) {
      scrollToToday();
    }
  }, [currentDate, viewType]);

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

      // Also fetch all requests for these events to determine accurate status in cards
      const requests = await pb.collection('agenda_cap53_almac_requests').getFullList({
        filter: res.length > 0 ? res.map(e => `event = "${e.id}"`).join(' || ') : 'id = "none"',
        expand: 'item',
        fields: 'id,event,status,expand.item.category',
        requestKey: null
      });

      // Map requests to events
      const eventsWithRequests = res.map(event => ({
        ...event,
        almac_requests: requests.filter(r => r.event === event.id)
      }));

      console.log('Eventos carregados:', eventsWithRequests.length);
      setEvents(eventsWithRequests);
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
    <div className="flex flex-col min-h-screen w-full">
      {/* Filters Bar - Fixed Top of Page */}
      <div className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-border-light shadow-sm w-full">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const today = new Date();
                const isAlreadyToday = currentDate.toDateString() === today.toDateString();
                setCurrentDate(today);
                updateURL(viewType, today, true);
                if (isAlreadyToday) {
                  scrollToToday();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl transition-all duration-300 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">today</span>
              Hoje
            </button>

            <div className="flex items-center bg-slate-100/50 rounded-xl p-1 border border-border-light">
              <button
                onClick={() => handleNavigate('prev')}
                className="size-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-text-secondary hover:text-primary transition-all duration-300"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <span className="px-4 text-[11px] md:text-xs font-black text-text-main min-w-[140px] md:min-w-[180px] text-center uppercase tracking-widest">
                {viewType === 'day'
                  ? currentDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
                  : currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => handleNavigate('next')}
                className="size-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-text-secondary hover:text-primary transition-all duration-300"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="flex bg-slate-100/50 p-1 rounded-xl border border-border-light">
            {(['day', 'week', 'month', 'agenda'] as const).map((view) => (
              <button
                key={view}
                onClick={() => updateURL(view, currentDate)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                  viewType === view 
                    ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' 
                    : 'text-text-secondary hover:text-text-main'
                }`}
              >
                {view === 'day' ? 'Dia' : view === 'week' ? 'Semana' : view === 'month' ? 'Mês' : 'Agenda'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>

      <div className="max-w-[1600px] mx-auto w-full p-2 md:p-4 lg:p-6">
        {/* Calendar Grid Container */}
        <div className="bg-white rounded-2xl border border-border-light shadow-sm flex-1 flex flex-col min-h-[750px] overflow-visible relative">
          {viewType === 'month' && (
            <div className="flex-1 flex flex-col">
              {/* Desktop Grid View */}
              <div className="hidden md:flex flex-col flex-1">
                <div className="grid grid-cols-7 border-b border-border-light bg-slate-50 sticky top-[120px] md:top-[64px] z-[90] shadow-sm">
                {daysLabels.map((day) => (
                    <div key={day} className="py-1.5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">
                    {day}
                  </div>
                ))}
              </div>
              <div className={`grid grid-cols-7 flex-1 divide-x divide-y divide-border-light border-l border-border-light bg-white ${
                getDatesForMonth(currentDate).length > 35 ? 'grid-rows-6' : 'grid-rows-5'
              }`}>
                {getDatesForMonth(currentDate).map((dateObj, idx) => {
                  const dateKey = dateObj.date.toDateString();
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isToday = dateObj.date.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={idx}
                      onDoubleClick={() => handleDayDoubleClick(dateObj.date)}
                      className={`flex flex-col p-1.5 md:p-2.5 relative group transition-all duration-300 cursor-default min-h-[120px] ${
                        dateObj.type === 'current' 
                          ? (isToday ? 'bg-primary/[0.02]' : 'bg-white hover:bg-slate-50/50') 
                          : 'bg-slate-50/30 text-text-secondary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateURL('day', dateObj.date);
                          }}
                          className={`text-[11px] md:text-xs font-black size-6 md:size-7 flex items-center justify-center transition-all duration-300 rounded-full hover:bg-primary hover:text-white ${
                            isToday ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-text-secondary group-hover:text-primary'
                          }`}
                        >
                          {dateObj.date.getDate()}
                        </button>
                        {dayEvents.length > 0 && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200/50 group/badge hover:bg-primary/5 hover:border-primary/20 transition-all duration-300">
                            <span className="material-symbols-outlined text-[10px] text-text-secondary/50 group-hover/badge:text-primary transition-colors">calendar_today</span>
                            <span className="text-[9px] font-black text-text-secondary group-hover/badge:text-primary transition-colors">
                              {dayEvents.length}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-0.5 max-h-[100px]">
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
            </div>

            {/* Mobile List View */}
            <div className="flex md:hidden flex-col bg-slate-50/30 p-2 gap-4">
              {getDatesForMonth(currentDate).filter(d => d.type === 'current').map((dateObj, idx) => {
                const date = dateObj.date;
                const dateKey = date.toDateString();
                const dayEvents = eventsByDate[dateKey] || [];
                const isToday = dateKey === new Date().toDateString();

                return (
                  <div 
                    key={idx} 
                    ref={isToday ? todayRef : null}
                    className={`bg-white rounded-2xl border border-border-light shadow-sm overflow-hidden transition-all duration-300 ${isToday ? 'ring-2 ring-primary/20 border-primary/20' : ''}`}
                  >
                    <div className={`px-4 py-3 flex items-center justify-between border-b border-slate-50 ${isToday ? 'bg-primary/5' : 'bg-slate-50/50'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-black ${isToday ? 'text-primary' : 'text-text-main opacity-30'}`}>
                          {String(date.getDate()).padStart(2, '0')}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-primary' : 'text-text-secondary'}`}>
                              {date.toLocaleDateString('pt-BR', { weekday: 'long' })}
                            </span>
                            {dayEvents.length > 0 && (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200/50">
                                <span className="material-symbols-outlined text-[10px] text-text-secondary/50">event</span>
                                <span className="text-[9px] font-black text-text-secondary">
                                  {dayEvents.length}
                                </span>
                              </div>
                            )}
                          </div>
                          {isToday && <span className="text-[9px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-widest mt-1 w-fit">Hoje</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => updateURL('day', date)}
                        className="size-8 flex items-center justify-center rounded-full hover:bg-white text-text-secondary hover:text-primary transition-all shadow-sm border border-transparent hover:border-border-light"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </button>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                      {dayEvents.length > 0 ? (
                        dayEvents.map(event => (
                          <CalendarEventCard
                            key={event.id}
                            event={event}
                            user={user}
                            onCancel={handleCancelEvent}
                            setTooltipData={setTooltipData}
                            onSelect={setSelectedEvent}
                          />
                        ))
                      ) : (
                        <div className="py-4 flex items-center justify-center text-center">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sem eventos</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewType === 'week' && (
          <div className={`flex-1 flex flex-col ${isCurrentWeek(currentDate) ? 'bg-white' : 'bg-slate-50/30'}`}>
            {/* Desktop Week View */}
            <div className="hidden md:flex flex-col flex-1">
              <div className="grid grid-cols-7 border-b border-border-light bg-slate-50 sticky top-[120px] md:top-[64px] z-[90] shadow-sm">
                {getDatesForWeek(currentDate).map((date, idx) => (
                    <div key={idx} className={`py-1.5 flex flex-col items-center gap-0.5 border-r border-border-light last:border-r-0 transition-all duration-300 ${
                    date.toDateString() === new Date().toDateString() ? 'bg-primary/10' : 'bg-slate-50'
                  }`}>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                      date.toDateString() === new Date().toDateString() ? 'text-primary' : 'text-text-secondary'
                    }`}>
                      {daysLabels[idx]}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateURL('day', date);
                        }}
                        className={`text-sm md:text-base font-black transition-all duration-300 hover:scale-110 active:scale-95 ${
                          date.toDateString() === new Date().toDateString() ? 'text-primary' : 'text-text-main hover:text-primary'
                        }`}
                      >
                        {date.getDate()}
                      </button>
                      {(eventsByDate[date.toDateString()] || []).length > 0 && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/50 border border-slate-200/50">
                          <span className="material-symbols-outlined text-[10px] text-text-secondary/50">calendar_month</span>
                          <span className="text-[9px] font-black text-text-secondary">
                            {(eventsByDate[date.toDateString()] || []).length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 flex-1 divide-x divide-border-light bg-white">
                {getDatesForWeek(currentDate).map((date, idx) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dayEvents = eventsByDate[date.toDateString()] || [];
                  return (
                    <div
                      key={idx}
                      onDoubleClick={() => handleDayDoubleClick(date)}
                      className={`flex flex-col p-3 gap-2 min-h-[600px] cursor-default transition-all duration-300 ${
                        isToday ? 'bg-primary/[0.02]' : 'hover:bg-slate-50/30'
                      }`}
                    >
                      <div className="flex flex-col gap-1.5 flex-1 group">
                        {dayEvents.length > 0 ? (
                          dayEvents.map(event => (
                            <CalendarEventCard
                              key={event.id}
                              event={event}
                              user={user}
                              onCancel={handleCancelEvent}
                              setTooltipData={setTooltipData}
                              onSelect={setSelectedEvent}
                            />
                          ))
                        ) : (
                          <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sem eventos</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Week List View */}
            <div className="flex md:hidden flex-col bg-slate-50/30 p-2 gap-4">
              {getDatesForWeek(currentDate).map((date, idx) => {
                const dateKey = date.toDateString();
                const dayEvents = eventsByDate[dateKey] || [];
                const isToday = dateKey === new Date().toDateString();

                return (
                  <div 
                    key={idx} 
                    ref={isToday ? todayRef : null}
                    className={`bg-white rounded-2xl border border-border-light shadow-sm overflow-hidden transition-all duration-300 ${isToday ? 'ring-2 ring-primary/20 border-primary/20' : ''}`}
                  >
                    <div className={`px-4 py-3 flex items-center justify-between border-b border-slate-50 ${isToday ? 'bg-primary/5' : 'bg-slate-50/50'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-black ${isToday ? 'text-primary' : 'text-text-main opacity-30'}`}>
                          {String(date.getDate()).padStart(2, '0')}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-primary' : 'text-text-secondary'}`}>
                            {date.toLocaleDateString('pt-BR', { weekday: 'long' })}
                          </span>
                          {isToday && <span className="text-[9px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-widest mt-1 w-fit">Hoje</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => updateURL('day', date)}
                        className="size-8 flex items-center justify-center rounded-full hover:bg-white text-text-secondary hover:text-primary transition-all shadow-sm border border-transparent hover:border-border-light"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </button>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                      {dayEvents.length > 0 ? (
                        dayEvents.map(event => (
                          <CalendarEventCard
                            key={event.id}
                            event={event}
                            user={user}
                            onCancel={handleCancelEvent}
                            setTooltipData={setTooltipData}
                            onSelect={setSelectedEvent}
                          />
                        ))
                      ) : (
                        <div className="py-4 flex items-center justify-center text-center">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sem eventos</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewType === 'day' && (
          <div 
            onDoubleClick={() => handleDayDoubleClick(currentDate)}
            className="flex-1 flex flex-col bg-white cursor-default relative"
            title="Clique duplo para novo evento"
          >
            <div className="sticky top-[120px] md:top-[64px] z-[90] bg-white border-b border-slate-100 px-4 md:px-8 py-3 shadow-sm">
              <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl md:text-3xl font-black text-primary tracking-tight">
                      {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                    </h2>
                    {(eventsByDate[currentDate.toDateString()] || []).length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10 shadow-sm">
                        <span className="material-symbols-outlined text-lg text-primary/60">event_available</span>
                        <span className="text-xs font-black text-primary">
                          {(eventsByDate[currentDate.toDateString()] || []).length}
                          <span className="ml-1 opacity-60 text-[10px] uppercase tracking-wider hidden sm:inline">Eventos</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-bold text-text-secondary uppercase tracking-[0.2em]">
                    {currentDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </p>
                </div>
                {currentDate.toDateString() === new Date().toDateString() && (
                  <span className="px-4 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-primary/20">
                    Hoje
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">

              <div className="space-y-4">
                {(() => {
                  const dayEvents = eventsByDate[currentDate.toDateString()] || [];
                  if (dayEvents.length === 0) {
                    return (
                      <div className="py-20 flex flex-col items-center justify-center text-center gap-4 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                        <span className="material-symbols-outlined text-5xl text-slate-300">calendar_today</span>
                        <div className="flex flex-col gap-1">
                          <p className="text-slate-500 font-bold">Nenhum evento agendado</p>
                          <p className="text-xs text-slate-400">Clique duas vezes para criar um novo evento</p>
                        </div>
                      </div>
                    );
                  }
                  return dayEvents.map(event => (
                    <div key={event.id} className="hover:translate-x-1 transition-transform duration-300">
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
              </div>
            </div>
          </div>
        )}

        {viewType === 'agenda' && (
          <div className="flex-1 flex flex-col bg-white relative">
            <div className="sticky top-[120px] md:top-[64px] z-[90] bg-white border-b border-slate-50 px-4 md:px-8 py-3 shadow-sm">
              <div className="max-w-5xl mx-auto w-full flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-2xl">view_agenda</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-text-main">Agenda do Mês</h3>
                  <p className="text-xs text-text-secondary font-black uppercase tracking-[0.2em] opacity-60">Visualize todos os compromissos</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 md:p-8 flex flex-col gap-12 max-w-5xl mx-auto w-full">
              {(() => {
                 // Filter events for the current month and year
                 const monthEvents = events.filter(e => {
                    const eDate = new Date(e.date_start || e.date);
                    return eDate.getMonth() === currentDate.getMonth() &&
                           eDate.getFullYear() === currentDate.getFullYear();
                 }).sort((a, b) => new Date(a.date_start || a.date).getTime() - new Date(b.date_start || b.date).getTime());

                 if (monthEvents.length === 0) {
                    return (
                        <div className="py-20 flex flex-col items-center justify-center text-center gap-4 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                          <span className="material-symbols-outlined text-5xl text-slate-300">event_busy</span>
                          <p className="text-slate-500 font-bold">Nenhum evento futuro encontrado</p>
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
                        <div 
                            key={dateStr} 
                            ref={isToday ? todayRef : null}
                            className={`flex flex-col md:flex-row gap-6 md:gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isToday ? 'relative' : 'opacity-80 hover:opacity-100 transition-opacity'}`}
                        >
                            <div className="flex md:flex-col items-center md:items-start gap-3 md:gap-0 md:w-32 shrink-0">
                                <span className={`text-4xl font-black ${isToday ? 'text-primary' : 'text-text-main opacity-30'}`}>{String(date.getDate()).padStart(2, '0')}</span>
                                <div className="flex flex-col leading-tight">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-primary' : 'text-text-secondary'}`}>{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                                    {isToday && <span className="text-[9px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-widest mt-1 w-fit shadow-md shadow-primary/20">Hoje</span>}
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-4 border-l-2 border-slate-50 pl-6 md:pl-12 pb-8">
                                {dayEvents.map(event => (
                                    <div key={event.id} className="hover:translate-x-1 transition-transform duration-300">
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

  // Helper to determine status for Almc/Copa/Inf
  const getRequestStatus = (category: 'ALMOXARIFADO' | 'COPA' | 'INFORMATICA') => {
    // Priority 1: Check actual requests (real-time data)
    const categoryRequests = requests.filter(r => r.expand?.item?.category === category);
    
    if (categoryRequests.length > 0) {
      const allConfirmed = categoryRequests.every(r => r.status === 'approved');
      const anyRejected = categoryRequests.some(r => r.status === 'rejected');

      if (anyRejected) return 'rejected';
      if (allConfirmed) return 'confirmed';
      return 'pending';
    }

    // Priority 2: Fallback to event summary fields (static data from fetchEvents)
    // This is useful for Informática and initial states
    const items = category === 'ALMOXARIFADO' ? (event.almoxarifado_items || []) :
                  category === 'COPA' ? (event.copa_items || []) :
                  (event.informatica_items || []);
                  
    if (items.length === 0) return null;

    const confirmedCount = category === 'ALMOXARIFADO' ? (event.almoxarifado_confirmed_items?.length || 0) :
                           category === 'COPA' ? (event.copa_confirmed_items?.length || 0) :
                           (event.informatica_confirmed_items?.length || 0);

    // If we don't have request records yet, we only know if it's all confirmed or pending
    return (confirmedCount === items.length && items.length > 0) ? 'confirmed' : 'pending';
  };

  const almcStatus = getRequestStatus('ALMOXARIFADO');
  const copaStatus = getRequestStatus('COPA');
  const infStatus = getRequestStatus('INFORMATICA');

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
    if (status === 'confirmed') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'confirmed') return 'OK';
    if (status === 'rejected') return 'REC';
    return 'PEND';
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
              De {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às {endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
        {(event.transporte_suporte || almcStatus || copaStatus || infStatus) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {event.transporte_suporte && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border-2 text-[8px] font-black uppercase tracking-wider ${
                event.transporte_status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' : 
                (event.transporte_status === 'rejected' || event.transporte_status === 'refused') ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-yellow-50 text-yellow-700 border-yellow-200'
              }`}>
                <span className="material-symbols-outlined text-[12px]">directions_car</span>
                {event.transporte_status === 'confirmed' ? 'TRA OK' : 
                 (event.transporte_status === 'rejected' || event.transporte_status === 'refused') ? 'TRA REC' : 
                 'TRA PEND'}
              </div>
            )}
            {almcStatus && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border-2 text-[8px] font-black uppercase tracking-wider ${getStatusStyle(almcStatus)}`}>
                <span className="material-symbols-outlined text-[12px]">inventory_2</span>
                ALM {getStatusLabel(almcStatus)}
              </div>
            )}
            {copaStatus && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border-2 text-[8px] font-black uppercase tracking-wider ${getStatusStyle(copaStatus)}`}>
                <span className="material-symbols-outlined text-[12px]">restaurant</span>
                COP {getStatusLabel(copaStatus)}
              </div>
            )}
            {infStatus && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border-2 text-[8px] font-black uppercase tracking-wider ${getStatusStyle(infStatus)}`}>
                <span className="material-symbols-outlined text-[12px]">terminal</span>
                INF {getStatusLabel(infStatus)}
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
  
  const getCategoryStatus = (category: 'ALMOXARIFADO' | 'COPA' | 'INFORMATICA') => {
    const categoryRequests = event.almac_requests?.filter((r: any) => r.expand?.item?.category === category) || [];
    if (categoryRequests.length > 0) {
      const allApproved = categoryRequests.every((r: any) => r.status === 'approved');
      const anyRejected = categoryRequests.some((r: any) => r.status === 'rejected');
      if (anyRejected) return 'rejected';
      if (allApproved) return 'confirmed';
      return 'pending';
    }
    const items = category === 'ALMOXARIFADO' ? (event.almoxarifado_items || []) :
                  category === 'COPA' ? (event.copa_items || []) :
                  (event.informatica_items || []);
    const confirmed = category === 'ALMOXARIFADO' ? (event.almoxarifado_confirmed_items || []) :
                      category === 'COPA' ? (event.copa_confirmed_items || []) :
                      (event.informatica_confirmed_items || []);
    if (items.length === 0) return null;
    return (confirmed.length === items.length && items.length > 0) ? 'confirmed' : 'pending';
  };

  const getStatusStyle = (status: string | null) => {
    if (status === 'confirmed') return 'bg-green-50 border-green-200 text-green-700';
    if (status === 'rejected') return 'bg-red-50 border-red-200 text-red-700';
    return 'bg-yellow-50 border-yellow-200 text-yellow-700';
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
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
      className={`w-full border-l-4 rounded-xl px-3 py-2 cursor-pointer transition-all duration-300 hover:translate-x-1 relative ${isCancelled
        ? 'bg-white border-slate-200 opacity-60'
        : 'bg-primary/[0.04] border-primary/50 hover:bg-primary/[0.1] hover:border-primary shadow-sm hover:shadow-md'
        } ${detailed ? 'p-6' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 overflow-hidden">
        <p className={`text-[11px] font-black leading-tight truncate ${detailed ? 'text-xl' : ''} ${isCancelled ? 'text-text-secondary line-through' : 'text-primary'}`}>
          {event.title}
        </p>
        {!detailed && <span className="text-[9px] font-black text-primary/50 whitespace-nowrap uppercase tracking-tighter">
          {new Date(event.date_start || event.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          {event.date_end && (
            <span className="ml-1 opacity-60">
              - {new Date(event.date_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>}
      </div>

      {detailed && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-4 text-[12px] font-bold text-text-secondary/80">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-lg opacity-50">schedule</span>
            <div className="flex items-center gap-1.5">
              <span>{new Date(event.date_start || event.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              {event.date_end && (
                <>
                  <span className="text-[10px] opacity-40 uppercase tracking-tighter font-black mx-0.5">até</span>
                  <span>{new Date(event.date_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-lg opacity-50">location_on</span>
            <span className="truncate max-w-[250px]">
              {event.expand?.location?.name || event.custom_location || 'Local não definido'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-lg opacity-50">person</span>
            {event.expand?.user?.name || 'Sistema'}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {getCategoryStatus('ALMOXARIFADO') !== null && (
          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border-2 uppercase tracking-wider ${getStatusStyle(getCategoryStatus('ALMOXARIFADO'))}`}>ALM</span>
        )}
        {getCategoryStatus('COPA') !== null && (
          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border-2 uppercase tracking-wider ${getStatusStyle(getCategoryStatus('COPA'))}`}>COP</span>
        )}
        {getCategoryStatus('INFORMATICA') !== null && (
          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border-2 uppercase tracking-wider ${getStatusStyle(getCategoryStatus('INFORMATICA'))}`}>INF</span>
        )}
        {event.transporte_suporte && (
          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border-2 uppercase tracking-wider ${
            event.transporte_status === 'confirmed' ? 'bg-green-50 border-green-200 text-green-700' :
            (event.transporte_status === 'rejected' || event.transporte_status === 'refused') ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-yellow-50 border-yellow-200 text-yellow-700'
          }`}>TRA</span>
        )}
        {isCancelled && (
          <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-red-50 border-2 border-red-200 text-red-700 uppercase tracking-wider">
            CANCELADO
          </span>
        )}
      </div>
    </div>
  );
};

export default Calendar;
