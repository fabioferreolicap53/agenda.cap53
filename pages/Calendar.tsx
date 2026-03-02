import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { useAuth, SECTORS, UserRole } from '../components/AuthContext';
import { notificationService } from '../lib/notifications';
import { 
  EventsResponse, 
  UsersResponse, 
  LocaisResponse, 
  AlmacRequestsResponse, 
  ItensServicoResponse,
  TiposEventoResponse,
  Collections
} from '../lib/pocketbase-types';

import ConfirmationModal from '../components/ConfirmationModal';
import RefusalModal from '../components/RefusalModal';
import EventDetailsModal from '../components/EventDetailsModal';
import CustomSelect from '../components/CustomSelect';
import CustomDayPicker from '../components/CustomDayPicker';
import { INVOLVEMENT_LEVELS, RESPONSIBILITY_LEVELS } from '../lib/constants';
import { deleteEventWithCleanup, getEstimatedParticipants } from '../lib/eventUtils';
import { notifyEventStatusChange, EventData } from '../lib/notificationUtils';
import { useSwipe } from '../hooks/useSwipe';

interface CalendarExpand {
  user?: UsersResponse;
  location?: LocaisResponse;
  participants?: UsersResponse[];
  type?: TiposEventoResponse;
  agenda_cap53_almac_requests_via_event?: AlmacRequestsResponse<{
    item: ItensServicoResponse;
  }>[];
}

// Extended Event interface to include missing fields from typegen
interface CalendarEvent extends EventsResponse<CalendarExpand> {
  status?: string;
  nature?: string;
  category?: string;
  date?: string;
  almoxarifado_items?: string[];
  copa_items?: string[];
  informatica_items?: string[];
  almoxarifado_confirmed_items?: string[];
  copa_confirmed_items?: string[];
  informatica_confirmed_items?: string[];
  transporte_suporte?: boolean;
  transporte_origem?: string;
  transporte_destino?: string;
  transporte_horario_levar?: string;
  transporte_horario_buscar?: string;
  transporte_obs?: string;
  transporte_status?: string;
  transporte_justification?: string;
  cancel_reason?: string;
  is_restricted?: boolean;
  almac_requests?: AlmacRequestsResponse<{
    item: ItensServicoResponse;
  }>[];
}

const Calendar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = (searchParams.get('search') || '').toLowerCase();
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<UsersResponse[]>([]);

  // Filters state with lazy initialization from localStorage to prevent race conditions
  // Helper to get storage keys based on current user
  const getStorageKey = (key: string) => user?.id ? `${key}_${user.id}` : key;

  const [filterUser, setFilterUser] = useState<string[]>(['Todos']);
  const [filterRoles, setFilterRoles] = useState<string[]>(['Todos']);
  const [filterSectors, setFilterSectors] = useState<string[]>(['Todos']);
  const [persistFilters, setPersistFilters] = useState(false);
  const [isFiltersLoaded, setIsFiltersLoaded] = useState(false);

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const dayViewRef = useRef<HTMLDivElement>(null);
  const agendaViewRef = useRef<HTMLDivElement>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (!filterUser.includes('Todos')) count++;
    if (!filterRoles.includes('Todos')) count++;
    if (!filterSectors.includes('Todos')) count++;
    return count;
  }, [filterUser, filterRoles, filterSectors]);

  // Initialize filters when user is available
  useEffect(() => {
    if (!user?.id) return;

    const savedPersist = localStorage.getItem(getStorageKey('calendar_persist_filters')) === 'true';
    setPersistFilters(savedPersist);

    if (savedPersist) {
        try {
            const savedUser = localStorage.getItem(getStorageKey('calendar_filter_user'));
            if (savedUser) setFilterUser(JSON.parse(savedUser));
            
            const savedRoles = localStorage.getItem(getStorageKey('calendar_filter_roles'));
            if (savedRoles) setFilterRoles(JSON.parse(savedRoles));

            const savedSectors = localStorage.getItem(getStorageKey('calendar_filter_sectors'));
            if (savedSectors) setFilterSectors(JSON.parse(savedSectors));
        } catch (e) {
            console.error('Error loading saved filters', e);
        }
    }
    setIsFiltersLoaded(true);
  }, [user?.id]);

  // Load users
   useEffect(() => {
       pb.collection(Collections.AgendaCap53Usuarios).getFullList({ 
           sort: 'name', 
           fields: 'id,name,sector',
           filter: 'hidden != true'
       })
           .then((res) => setUsers(res as unknown as UsersResponse[]))
           .catch(console.error);
   }, []);

  // Save filters persistence
  useEffect(() => {
      if (!user?.id || !isFiltersLoaded) return;

      const keys = {
          persist: getStorageKey('calendar_persist_filters'),
          user: getStorageKey('calendar_filter_user'),
          roles: getStorageKey('calendar_filter_roles'),
          sectors: getStorageKey('calendar_filter_sectors')
      };

      if (persistFilters) {
          localStorage.setItem(keys.persist, 'true');
          localStorage.setItem(keys.user, JSON.stringify(filterUser));
          localStorage.setItem(keys.roles, JSON.stringify(filterRoles));
          localStorage.setItem(keys.sectors, JSON.stringify(filterSectors));
      } else {
          localStorage.removeItem(keys.persist);
          localStorage.removeItem(keys.user);
          localStorage.removeItem(keys.roles);
          localStorage.removeItem(keys.sectors);
      }
  }, [filterUser, filterRoles, filterSectors, persistFilters, user?.id, isFiltersLoaded]);

  const userOptions = useMemo(() => [
      { value: 'Todos', label: 'Todos os usuários' },
      { value: 'me', label: `Eu (${user?.name || '...'})` },
      ...users.filter(u => u.id !== user?.id).map(u => ({ value: u.id, label: u.name }))
  ], [users, user]);

  const roleOptions = [
      { value: 'Todos', label: 'Todos os papéis' },
      { value: 'CRIADOR', label: 'Criador' },
      ...INVOLVEMENT_LEVELS.map(l => ({ value: l.value, label: l.label }))
  ];

  const sectorOptions = [
      { value: 'Todos', label: 'Todos os setores' },
      ...SECTORS.map(s => ({ value: s, label: s }))
  ];

  const filteredEvents = useMemo(() => {
    let result = events;

    // Text Search
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(e => 
          (e.title || '').toLowerCase().includes(lower) ||
          (e.description || '').toLowerCase().includes(lower) ||
          (e.location || '').toLowerCase().includes(lower) ||
          (e.nature || '').toLowerCase().includes(lower) ||
          (e.category || '').toLowerCase().includes(lower)
        );
    }

    // Sector Filter
    if (!filterSectors.includes('Todos') && filterSectors.length > 0) {
        result = result.filter(e => {
            // Check creator's sector
            const creatorSector = e.expand?.user?.sector;
            if (creatorSector && filterSectors.includes(creatorSector)) return true;
            
            return false;
        });
    }

    // User & Role Filter
    if ((!filterUser.includes('Todos') && filterUser.length > 0) || (!filterRoles.includes('Todos') && filterRoles.length > 0)) {
        result = result.filter(e => {
            // Case 1: Filter by specific users
            if (!filterUser.includes('Todos') && filterUser.length > 0) {
                // Resolve 'me' to actual ID
                const targetUserIds = filterUser.map(id => id === 'me' ? user?.id : id).filter(Boolean);
                
                return targetUserIds.some(targetId => {
                    const userRoles: string[] = [];
                    
                    // Check creator
                    if (e.user === targetId) userRoles.push('CRIADOR');
                    
                    // Check explicit roles
                    if (e.participants_roles && e.participants_roles[targetId]) {
                        userRoles.push(e.participants_roles[targetId]);
                    }
                    
                    // Check participant without explicit role
                    if (e.participants && e.participants.includes(targetId)) {
                        const hasExplicitRole = e.participants_roles && e.participants_roles[targetId];
                        if (!hasExplicitRole && e.user !== targetId) {
                            userRoles.push('PARTICIPANTE');
                        }
                    }
                    
                    if (userRoles.length === 0) return false;
                    
                    if (filterRoles.includes('Todos') || filterRoles.length === 0) return true;
                    
                    return userRoles.some(r => filterRoles.includes(r));
                });
            }
            
            // Case 2: Filter by roles only (User is 'Todos')
            if (filterRoles.length > 0 && !filterRoles.includes('Todos')) {
                // Check if ANYONE in the event has one of the selected roles
                // 1. Check Creator
                if (filterRoles.includes('CRIADOR')) return true; // Creator always exists
                
                // 2. Check Participants Roles
                if (e.participants_roles) {
                    const rolesInEvent = Object.values(e.participants_roles);
                    if (rolesInEvent.some((r: string) => filterRoles.includes(r))) return true;
                }
                
                // 3. Check generic 'PARTICIPANTE'
                if (filterRoles.includes('PARTICIPANTE')) {
                    // If there are participants
                    if (e.participants && e.participants.length > 0) {
                        // And if we are looking for generic participants, we assume anyone in participants list 
                        // who is NOT the creator effectively acts as a participant.
                        // However, to be strict, we should check if they have a specific role assigned.
                        // If logic above assigns 'PARTICIPANTE' when no explicit role, we replicate that check:
                        const hasGenericParticipant = e.participants.some((pId: string) => {
                            const explicitRole = e.participants_roles && e.participants_roles[pId];
                            return !explicitRole && pId !== e.user;
                        });
                        if (hasGenericParticipant) return true;
                    }
                }
                
                // If we are looking for specific roles like ORGANIZADOR and they weren't found in step 2
                return false;
            }
            
            return true;
        });
    }

    return result;
  }, [events, searchTerm, filterUser, filterRoles, filterSectors, user]);

  // Group events by date for efficient lookup
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach(event => {
      const date = new Date(event.date_start || '');
      const key = date.toDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    return grouped;
  }, [filteredEvents]);
  
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
     // Mobile/Tablet default view: Day (DIA)
     if (typeof window !== 'undefined' && window.innerWidth < 1024) {
         return 'day';
     }
     return 'month';
    });

  // Handle browser back/forward buttons
  useEffect(() => {
      const view = searchParams.get('view');
      if (view && view !== viewType && (view === 'month' || view === 'week' || view === 'day' || view === 'agenda')) {
        setViewType(view as 'month' | 'week' | 'day' | 'agenda');
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

    // Check for mobile/tablet breakpoint
    const [isMobileOrTablet, setIsMobileOrTablet] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
          setIsMobileOrTablet(window.innerWidth < 1024);
          setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const viewParam = searchParams.get('view');

    // Enforce initial view if no view parameter is present
    useEffect(() => {
        if (!viewParam) {
            const defaultView = isMobileOrTablet ? 'day' : 'month';
            if (viewType !== defaultView) {
              setViewType(defaultView);
            }
            updateURL(defaultView, currentDate, true);
        }
    }, [isMobileOrTablet, viewType, currentDate, viewParam]);

    // Check if we are on the initial default view
    const isInitialView = useMemo(() => {
        const defaultView = isMobileOrTablet ? 'day' : 'month';
        return viewType === defaultView;
    }, [viewType, isMobileOrTablet]);

    const showBackButton = !isMobileOrTablet && !isInitialView;
  const [tooltipData, setTooltipData] = useState<{ event: CalendarEvent, x: number, y: number, height: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [initialChatOpen, setInitialChatOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'details' | 'dashboard' | 'transport' | 'resources' | 'professionals' | 'requests'>('details');
  const [returnPath, setReturnPath] = useState<string | null>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const firstEventRef = useRef<HTMLDivElement>(null);
  const agendaTargetRef = useRef<HTMLDivElement>(null);
  const monthWeekTargetRef = useRef<HTMLDivElement>(null);

  // Dynamic Scroll Margin based on sticky bars and filters state
  const scrollMarginClass = useMemo(() => {
    // Height of the sticky toolbar inside the scroll container
    // Mobile: py-2(16) + Row1(42) + gap-3(12) + Row2(42) = 112px
    // Desktop: py-2(16) + Row1(42) = 58px
    if (showFilters) {
      // Mobile filters: ~300px, Desktop filters: ~120px
      return 'scroll-mt-[412px] md:scroll-mt-[178px]';
    }
    return 'scroll-mt-[112px] md:scroll-mt-[58px]';
  }, [showFilters]);

  const agendaMonthEvents = useMemo(() => {
    return filteredEvents
      .filter(e => {
        const eDate = new Date(e.date_start || '');
        return eDate.getMonth() === currentDate.getMonth() &&
               eDate.getFullYear() === currentDate.getFullYear();
      })
      .sort((a, b) => new Date(a.date_start || '').getTime() - new Date(b.date_start || '').getTime());
  }, [filteredEvents, currentDate]);

  const monthRangeStart = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const monthRangeEnd = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [currentDate]);

  const weekRangeStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const weekRangeEnd = useMemo(() => {
    const d = new Date(weekRangeStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekRangeStart]);

  const agendaTargetDateKey = useMemo(() => {
    if (agendaMonthEvents.length === 0) return null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayEvent = agendaMonthEvents.find(e => {
      const d = new Date(e.date_start || '');
      return d >= todayStart && d <= todayEnd;
    });
    if (todayEvent) return new Date(todayEvent.date_start || '').toDateString();
    const nextEvent = agendaMonthEvents.find(e => new Date(e.date_start || '') > todayEnd);
    return new Date((nextEvent || agendaMonthEvents[0]).date_start || '').toDateString();
  }, [agendaMonthEvents]);

  const monthTargetDateKey = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (agendaMonthEvents.length === 0) {
      const today = new Date();
      if (today >= monthRangeStart && today <= monthRangeEnd) return today.toDateString();
      return monthRangeStart.toDateString();
    }
    const todayEvent = agendaMonthEvents.find(e => {
      const d = new Date(e.date_start || '');
      return d >= todayStart && d <= todayEnd;
    });
    if (todayEvent) return new Date(todayEvent.date_start || '').toDateString();
    const nextEvent = agendaMonthEvents.find(e => new Date(e.date_start || '') > todayEnd);
    if (nextEvent) return new Date(nextEvent.date_start || '').toDateString();
    return monthRangeStart.toDateString();
  }, [agendaMonthEvents, monthRangeStart, monthRangeEnd]);

  const weekEvents = useMemo(() => {
    return filteredEvents
      .filter(e => {
        const d = new Date(e.date_start || '');
        return d >= weekRangeStart && d <= weekRangeEnd;
      })
      .sort((a, b) => new Date(a.date_start || '').getTime() - new Date(b.date_start || '').getTime());
  }, [filteredEvents, weekRangeStart, weekRangeEnd]);

  const weekTargetDateKey = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (weekEvents.length === 0) {
      const today = new Date();
      if (today >= weekRangeStart && today <= weekRangeEnd) return today.toDateString();
      return weekRangeStart.toDateString();
    }
    const todayEvent = weekEvents.find(e => {
      const d = new Date(e.date_start || '');
      return d >= todayStart && d <= todayEnd;
    });
    if (todayEvent) return new Date(todayEvent.date_start || '').toDateString();
    const nextEvent = weekEvents.find(e => new Date(e.date_start || '') > todayEnd);
    if (nextEvent) return new Date(nextEvent.date_start || '').toDateString();
    return weekRangeStart.toDateString();
  }, [weekEvents, weekRangeStart, weekRangeEnd]);

  // Animation States
  const [animStage, setAnimStage] = useState<'idle' | 'exiting' | 'entering'>('idle');
  const [animDirection, setAnimDirection] = useState<'next' | 'prev'>('next');

  // Refusal Modal State for Event Cancellation
  const [refusalModalOpen, setRefusalModalOpen] = useState(false);
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
  const [eventToCancel, setEventToCancel] = useState<{ id: string, title: string } | null>(null);
  const [processingCancellation, setProcessingCancellation] = useState(false);

  // Function to scroll to today and center it
  const scrollToToday = () => {
    setTimeout(() => {
      // Configuração base de scroll
      const scrollConfig: ScrollIntoViewOptions = {
        behavior: 'smooth',
        block: viewType === 'agenda' || viewType === 'day' ? 'start' : 'center',
        inline: 'center'
      };

      // Prioritize focusing on the first event if it exists (only for DIA view on desktop/tablet)
      if (viewType === 'day' && firstEventRef.current && !isMobile) {
        firstEventRef.current.scrollIntoView(scrollConfig);
        return;
      }

      if ((viewType === 'month' || viewType === 'week') && monthWeekTargetRef.current) {
        monthWeekTargetRef.current.scrollIntoView(scrollConfig);
        return;
      }

      if (viewType === 'agenda' && agendaTargetRef.current) {
        agendaTargetRef.current.scrollIntoView(scrollConfig);
        return;
      }

      if (todayRef.current) {
        todayRef.current.scrollIntoView(scrollConfig);
        return;
      }

      if (viewType === 'day' && dayViewRef.current) {
        dayViewRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      } else if (viewType === 'agenda' && agendaViewRef.current) {
        agendaViewRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 600); // Aumentado para 600ms para garantir que animações de entrada terminaram
  };

  // Handle openChat or eventId from URL
  useEffect(() => {
    const chatEventId = searchParams.get('openChat');
    const viewEventId = searchParams.get('eventId');
    const tabParam = searchParams.get('tab');
    const fromParam = searchParams.get('from');
    const targetEventId = chatEventId || viewEventId;

    if (targetEventId) {
      if (import.meta.env.DEV) {
        console.log('Calendar: targetEventId found in URL:', targetEventId);
      }

      // Se já estivermos com este evento selecionado, não fazemos nada
      if (selectedEvent?.id === targetEventId) {
        if (import.meta.env.DEV) {
          console.log('Calendar: event already selected, skipping');
        }
        return;
      }

      const openModal = (event: CalendarEvent) => {
        if (import.meta.env.DEV) {
          console.log('Calendar: Opening modal for event:', event.id);
        }
        setSelectedEvent(event);
        setInitialChatOpen(!!chatEventId);
        
        if (tabParam && ['details', 'dashboard', 'transport', 'resources', 'professionals', 'requests'].includes(tabParam)) {
          setInitialTab(tabParam as 'details' | 'dashboard' | 'transport' | 'resources' | 'professionals' | 'requests');
        } else {
          setInitialTab('details');
        }

        if (fromParam) {
          if (fromParam === 'notifications') {
            setReturnPath('/notifications');
          } else if (fromParam !== location.pathname) {
            setReturnPath(fromParam);
          }
        }
      };

      // Tenta encontrar o evento na lista local primeiro
      const event = events.find(e => e.id === targetEventId);
      if (event) {
        if (import.meta.env.DEV) {
          console.log('Calendar: Event found in local list');
        }
        openModal(event);
      } else {
        if (import.meta.env.DEV) {
          console.log('Calendar: Event not found in local list, fetching from PB');
        }
        // Se não encontrou localmente, busca no PocketBase
        pb.collection('agenda_cap53_eventos').getOne<CalendarEvent>(targetEventId, {
          expand: 'user,location,participants,type,agenda_cap53_almac_requests_via_event,agenda_cap53_almac_requests_via_event.item'
        })
        .then((record) => {
          if (import.meta.env.DEV) {
            console.log('Calendar: Event fetched from PB successfully');
          }
          const eventWithRequests: CalendarEvent = {
            ...record,
            almac_requests: record.expand?.agenda_cap53_almac_requests_via_event || []
          };
          openModal(eventWithRequests);
        })
        .catch(err => {
          console.error('Calendar: Erro ao buscar evento para o modal:', err);
          // Se o evento não existir, removemos o parâmetro da URL
          if (err.status === 404) {
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('eventId');
            newParams.delete('openChat');
            setSearchParams(newParams, { replace: true });
          }
        });
      }
    }
  }, [searchParams, events]); // Removido selectedEvent?.id dos dependentes para evitar re-abertura do modal no fechamento

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
    // Scroll whenever viewType or currentDate changes to ensure focus
    scrollToToday();
  }, [currentDate, viewType]);

  useEffect(() => {
    if (viewType !== 'agenda' || !isMobileOrTablet) return;
    if (!agendaTargetRef.current) return;
    const timeout = setTimeout(() => {
      agendaTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => clearTimeout(timeout);
  }, [viewType, isMobileOrTablet, agendaTargetDateKey]);

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
        expand: 'user,location,participants,type,agenda_cap53_almac_requests_via_event,agenda_cap53_almac_requests_via_event.item,agenda_cap53_solicitacoes_evento(event)',
        fields: 'id,title,type,description,observacoes,date_start,date_end,location,custom_location,user,participants,participants_roles,creator_role,status,almoxarifado_items,copa_items,informatica_items,transporte,transporte_suporte,transporte_origem,transporte_destino,transporte_horario_levar,transporte_horario_buscar,transporte_obs,unidades,categorias_profissionais,transporte_status,transporte_justification,participants_status,cancel_reason,almoxarifado_confirmed_items,copa_confirmed_items,informatica_confirmed_items,is_restricted,event_responsibility,estimated_participants,expand',
        requestKey: null
      });

      // Map requests to events directly from expand
      const eventsWithRequests: CalendarEvent[] = res.map(event => ({
        ...event,
        almac_requests: event.expand?.agenda_cap53_almac_requests_via_event || []
      })) as CalendarEvent[];

      setEvents(eventsWithRequests);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEvent = async (eventId: string, title: string, participants: string[]) => {
    setEventToCancel({ id: eventId, title });
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

      // 2. Buscar evento atualizado e notificar todos os envolvidos
      try {
        const updatedEvent = await pb.collection('agenda_cap53_eventos').getOne(eventToCancel.id);
        if (user) {
            await notifyEventStatusChange(updatedEvent as unknown as EventData, 'canceled', justification, user.id);
        }
      } catch (notifErr) {
        console.error('Erro ao enviar notificações de cancelamento:', notifErr);
      }

      // alert('Evento cancelado com sucesso.');
      fetchEvents();
      if (selectedEvent?.id === eventToCancel.id) {
          setSelectedEvent(null);
          // Limpar parâmetros de URL ao fechar o modal por cancelamento
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('eventId');
          newParams.delete('openChat');
          newParams.delete('tab');
          newParams.delete('from');
          setSearchParams(newParams, { replace: true });
      }
    } catch (error) {
      console.error('Error cancelling event:', error);
      alert('Erro ao cancelar evento.');
    } finally {
        setProcessingCancellation(false);
        setRefusalModalOpen(false);
        setEventToCancel(null);
    }
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    setConfirmationModalConfig({
        title: 'Excluir Evento',
        description: `Tem certeza que deseja EXCLUIR permanentemente o evento "${event.title}"? Esta ação não pode ser desfeita e removerá todas as notificações vinculadas.`,
        confirmText: 'Excluir',
        variant: 'danger',
        onConfirm: async () => {
            try {
                // Use client-side cleanup utility to delete notifications first,
                // then delete the event. This provides redundancy to the server-side hook.
                await deleteEventWithCleanup(event.id, user?.id);

                setSelectedEvent(null);
                // Limpar parâmetros de URL ao fechar o modal por exclusão
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('eventId');
                newParams.delete('openChat');
                newParams.delete('tab');
                newParams.delete('from');
                setSearchParams(newParams, { replace: true });
                
                fetchEvents();
                setConfirmationModalOpen(false);
            } catch (error) {
                console.error('Error deleting event:', error);
                const msg = error instanceof Error ? error.message : 'Erro desconhecido';
                alert(`Erro ao excluir evento: ${msg}`);
            }
        }
    });
    setConfirmationModalOpen(true);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleDayDoubleClick = (date: Date) => {
    if (user && ['DCA', 'ALMC', 'TRA'].includes(user.role)) {
        alert('Você não tem permissão para criar eventos.');
        return;
    }

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
    
    // Preservar parâmetros existentes (como eventId ou openChat)
    const newParams = new URLSearchParams(searchParams);
    
    // Evitar atualizar se nada mudou
    if (newParams.get('view') === newView && newParams.get('date') === dateStr) {
      return;
    }

    newParams.set('view', newView);
    newParams.set('date', dateStr);
    
    setSearchParams(newParams, { replace });
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (animStage !== 'idle') return; // Prevent spamming

    setAnimDirection(direction);
    setAnimStage('exiting');

    const timeoutId = setTimeout(() => {
        const newDate = new Date(currentDate);
        if (viewType === 'month' || viewType === 'agenda') {
          newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        } else if (viewType === 'week') {
          newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        } else {
          newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        }
        setCurrentDate(newDate);
        updateURL(viewType, newDate, true); // Replace for simple navigation
        
        setAnimStage('entering');
        
        // Use a more robust reset for animation stage
        setTimeout(() => {
            setAnimStage('idle');
        }, 50);
    }, 300); // Match CSS transition duration

    // Safety cleanup in case component unmounts or something goes wrong
    return () => clearTimeout(timeoutId);
  };

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => handleNavigate('next'),
    onSwipeRight: () => handleNavigate('prev'),
    rangeOffset: 35 // Optimized for mobile screens
  });

  return (
    <div className="flex flex-col min-h-screen w-full">
      {/* Filters Bar - Fixed Top of Page */}
      <div className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-border-light shadow-sm w-full">
        <div className="max-w-[1920px] mx-auto px-2 md:px-4 py-2">
          <div className="flex flex-col gap-3">
            {/* Barra Principal: Navegação + Tipos de View */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Grupo de Navegação e Filtro (Esquerda/Centro) */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
                  {/* Botão Voltar */}
                  {showBackButton && (
                    <button
                      onClick={() => navigate(-1)}
                      className="size-[42px] flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-slate-50 transition-all duration-300 active:scale-95 shrink-0 group"
                    >
                      <span className="material-symbols-outlined text-[20px] font-light group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
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
                      className="h-[42px] flex items-center gap-2 px-3 sm:px-4 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl transition-all duration-300 active:scale-95 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">today</span>
                      <span className="hidden min-[400px]:inline">Hoje</span>
                    </button>
                  </div>

                  <div className="h-[42px] flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200 flex-1 sm:flex-none justify-center">
                    <button
                      onClick={() => handleNavigate('prev')}
                      className="h-full aspect-square flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-slate-400 hover:text-primary transition-all duration-300 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                    </button>
                    
                    {/* Indicação de Mês e Ano */}
                    <div className="h-full px-2 sm:px-4 flex items-center min-w-[120px] sm:min-w-[160px] justify-center">
                      <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-[0.05em] sm:tracking-[0.15em] text-slate-900 whitespace-nowrap">
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>

                    <button
                      onClick={() => handleNavigate('next')}
                      className="h-full aspect-square flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-slate-400 hover:text-primary transition-all duration-300 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>
                  </div>

                  {/* Botão de Filtros - Moderno */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`h-[42px] flex items-center gap-2.5 px-3 sm:px-5 rounded-xl border transition-all duration-300 active:scale-95 shrink-0 relative ${
                      showFilters || activeFiltersCount > 0
                        ? 'bg-[#1e293b] text-white border-[#1e293b] shadow-lg shadow-slate-200' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showFilters ? 'filter_list_off' : 'filter_alt'}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest hidden min-[400px]:inline">
                      Filtros
                    </span>
                    {activeFiltersCount > 0 && (
                      <span className={`flex items-center justify-center size-5 rounded-full text-[10px] font-bold border-2 ${
                        showFilters || activeFiltersCount > 0 ? 'bg-white text-[#1e293b] border-[#1e293b]' : 'bg-primary text-white border-white'
                      }`}>
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>

                  {/* CustomDayPicker - Disponível em Tablet e Desktop */}
                  <div className="hidden sm:block">
                    <CustomDayPicker 
                        value={currentDate}
                        onChange={(date) => {
                          setCurrentDate(date);
                          updateURL('day', date, true);
                        }}
                    />
                  </div>
                </div>
              </div>

              {/* View Type Group */}
              <div className="h-[42px] flex bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0 w-full md:w-auto justify-center overflow-x-auto no-scrollbar">
                  {(['day', 'week', 'month', 'agenda'] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => updateURL(view, currentDate)}
                      className={`h-full px-4 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 whitespace-nowrap ${
                        viewType === view 
                          ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {view === 'day' ? 'Dia' : view === 'week' ? 'Sem' : view === 'month' ? 'Mês' : 'Age'}
                    </button>
                  ))}
              </div>
            </div>

            {/* Painel de Filtros - Otimizado para ocupar apenas uma linha no desktop */}
            <div className={`${showFilters ? 'flex flex-col lg:flex-row p-4 mt-2 border border-slate-100 bg-slate-50/80 rounded-2xl animate-in slide-in-from-top-2 fade-in duration-300 shadow-inner' : 'hidden'} items-center lg:items-end gap-6 w-full z-[101] relative transition-all`}>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-md md:max-w-none">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center justify-center md:justify-start gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 md:ml-1">
                      <span className="material-symbols-outlined text-[14px]">person</span>
                      Usuários
                    </label>
                    <div className="h-[40px]">
                      <CustomSelect
                          value={filterUser}
                          onChange={setFilterUser}
                          options={userOptions}
                          multiSelect={true}
                          searchable={true}
                          placeholder="Todos os Usuários"
                          startIcon="group"
                          className="w-full h-full"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center justify-center md:justify-start gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 md:ml-1">
                      <span className="material-symbols-outlined text-[14px]">apartment</span>
                      Setores
                    </label>
                    <div className="h-[40px]">
                      <CustomSelect
                          value={filterSectors}
                          onChange={setFilterSectors}
                          options={sectorOptions}
                          multiSelect={true}
                          placeholder="Todos os Setores"
                          startIcon="domain"
                          className="w-full h-full"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center justify-center md:justify-start gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 md:ml-1">
                      <span className="material-symbols-outlined text-[14px]">badge</span>
                      Papéis
                    </label>
                    <div className="h-[40px]">
                      <CustomSelect
                          value={filterRoles}
                          onChange={setFilterRoles}
                          options={roleOptions}
                          multiSelect={true}
                          placeholder="Todos os Papéis"
                          startIcon="manage_accounts"
                          className="w-full h-full"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-center lg:justify-start gap-2 shrink-0 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-200/50">
                  <button
                    onClick={() => {
                      setFilterUser(['Todos']);
                      setFilterRoles(['Todos']);
                      setFilterSectors(['Todos']);
                    }}
                    className="h-[40px] px-4 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:rotate-180 transition-transform duration-500">filter_alt_off</span>
                    <span className="hidden xl:inline">Limpar Filtros</span>
                    <span className="xl:hidden">Limpar</span>
                  </button>

                  <label className={`flex items-center justify-center gap-2.5 text-[9px] font-black uppercase tracking-widest cursor-pointer select-none transition-all duration-300 px-6 rounded-xl border h-[40px] flex-1 lg:flex-none ${persistFilters ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:text-primary hover:border-primary/30 hover:shadow-md'}`}>
                      <input 
                        type="checkbox" 
                        checked={persistFilters} 
                        onChange={(e) => setPersistFilters(e.target.checked)}
                        className="hidden"
                      />
                      <span className="material-symbols-outlined text-[18px]">
                          {persistFilters ? 'bookmark_check' : 'bookmark'}
                      </span>
                      <span className="hidden xl:inline">{persistFilters ? 'Preferências Salvas' : 'Salvar Preferências'}</span>
                      <span className="xl:hidden">{persistFilters ? 'Salvo' : 'Salvar'}</span>
                  </label>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto w-full p-2 md:p-4 lg:p-6">
        {/* Calendar Grid Container */}
        <div 
          {...swipeHandlers} 
          className={`bg-white rounded-2xl border border-border-light shadow-sm flex-1 flex flex-col min-h-[500px] md:min-h-[750px] overflow-visible relative transition-all duration-300 ease-in-out transform touch-pan-y ${
            animStage === 'exiting' 
              ? (animDirection === 'next' ? '-translate-x-10 opacity-0' : 'translate-x-10 opacity-0')
              : animStage === 'entering'
                ? (animDirection === 'next' ? 'translate-x-10 opacity-0' : '-translate-x-10 opacity-0')
                : 'translate-x-0 opacity-100'
          }`}
        >
          {viewType === 'month' && (
            <div className="flex-1 flex flex-col">
              {/* Header Section for Month View */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 px-4 md:px-8 py-6 md:py-4 bg-slate-50/50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm mx-2 md:mx-8 mt-2 md:mt-4 transition-all duration-500 hover:shadow-md">
                <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto">
                  <div className="size-14 md:size-18 rounded-[1.2rem] md:rounded-[1.5rem] bg-white shadow-xl shadow-primary/10 flex items-center justify-center ring-1 ring-primary/10 transition-transform hover:scale-105 duration-500 shrink-0">
                    <span className="material-symbols-outlined text-[28px] md:text-[36px] text-primary font-light">calendar_month</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-black text-text-main leading-tight">Visualização Mensal</h3>
                    <p className="hidden md:block text-[10px] text-text-secondary font-black uppercase tracking-[0.2em] opacity-60">Visão geral do mês selecionado</p>
                    <p className="md:hidden text-[10px] text-text-secondary font-bold uppercase tracking-widest opacity-40 mt-1">Navegue pelos dias do mês</p>
                  </div>
                </div>
              </div>

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
                  const isWeekend = dateObj.date.getDay() === 0 || dateObj.date.getDay() === 6;

                  return (
                    <div
                      key={idx}
                      ref={dateKey === monthTargetDateKey ? monthWeekTargetRef : (isToday ? todayRef : null)}
                      onDoubleClick={() => handleDayDoubleClick(dateObj.date)}
                      className={`flex flex-col p-1.5 md:p-2.5 relative group transition-all duration-300 cursor-default min-h-[120px] ${scrollMarginClass} ${
                        dateObj.type === 'current' 
                          ? (isToday 
                              ? 'bg-primary/[0.04] shadow-[inset_0_0_20px_rgba(var(--color-primary-rgb),0.05)] ring-1 ring-inset ring-primary/20' 
                              : (isWeekend ? 'bg-orange-50/60 hover:bg-orange-100/60' : 'bg-white hover:bg-slate-50/50')) 
                          : 'bg-slate-100/70 text-text-secondary/40'
                      }`}
                    >
                      {/* Subtil pattern for out-of-month days */}
                      {dateObj.type !== 'current' && (
                        <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '4px 4px' }}></div>
                      )}
                      {/* Weekend indicator for current month */}
                      {dateObj.type === 'current' && isWeekend && !isToday && (
                        <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity">
                          <div className="size-1.5 rounded-full bg-orange-400"></div>
                        </div>
                      )}
                      {/* Glow effect for today */}
                      {isToday && (
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-primary/[0.08] to-transparent"></div>
                      )}
                      <div className="flex items-center justify-between mb-1.5 relative z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateURL('day', dateObj.date);
                          }}
                          className={`text-[11px] md:text-xs font-black size-6 md:size-7 flex items-center justify-center transition-all duration-300 rounded-full ${
                            isToday 
                              ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110 ring-2 ring-white' 
                              : (isWeekend && dateObj.type === 'current' ? 'text-orange-600/80 group-hover:text-primary hover:bg-primary/10' : 'text-text-secondary group-hover:text-primary hover:bg-primary/10')
                          }`}
                        >
                          {dateObj.date.getDate()}
                        </button>
                        {dayEvents.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateURL('day', dateObj.date);
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200/50 group/badge hover:bg-primary/5 hover:border-primary/20 transition-all duration-300 active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[10px] text-text-secondary/50 group-hover/badge:text-primary transition-colors">calendar_today</span>
                            <span className="text-[9px] font-black text-text-secondary group-hover/badge:text-primary transition-colors">
                              {dayEvents.length}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className={`flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-0.5 max-h-[100px] transition-all duration-300 ${dateObj.type !== 'current' ? 'opacity-50 grayscale-[0.3]' : ''}`}>
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
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();

                return (
                  <div 
                    key={idx} 
                    ref={dateKey === monthTargetDateKey ? monthWeekTargetRef : (isToday ? todayRef : null)}
                    className={`rounded-3xl border border-border-light shadow-sm overflow-hidden transition-all duration-300 relative ${scrollMarginClass} ${
                      isToday 
                        ? 'bg-primary/[0.04] border-2 border-primary/20 shadow-xl shadow-primary/5 ring-4 ring-primary/5' 
                        : (isWeekend ? 'bg-orange-50/60 border-orange-200' : 'bg-white hover:bg-slate-50/50')
                    }`}
                  >
                    {/* Subtil pattern for out-of-month days */}
                    {isWeekend && !isToday && (
                      <div className="absolute top-3 right-3 opacity-30">
                        <div className="size-2 rounded-full bg-orange-400/50"></div>
                      </div>
                    )}
                    {/* Glow effect for today */}
                    {isToday && (
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-primary/[0.08] via-transparent to-transparent"></div>
                    )}
                    
                    <div className={`px-4 py-4 flex items-center justify-between border-b border-slate-50 relative z-10 ${isToday ? 'bg-primary/5' : (isWeekend ? 'bg-orange-50/30' : 'bg-slate-50/50')}`}>
                      <div className="flex items-center gap-4">
                        <span className={`text-4xl font-black tracking-tighter transition-all duration-500 ${isToday ? 'text-primary' : (isWeekend ? 'text-orange-600/80' : 'text-text-main opacity-30')}`}>
                          {String(date.getDate()).padStart(2, '0')}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className={`text-[11px] font-black uppercase tracking-[0.15em] ${isToday ? 'text-primary' : (isWeekend ? 'text-orange-600/70' : 'text-text-secondary')}`}>
                            {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                          </span>
                          <span className={`text-[9px] font-medium uppercase tracking-widest ${isToday ? 'text-primary/60' : 'text-text-secondary/60'}`}>
                            {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                          </span>
                          {isToday && <span className="text-[8px] font-black bg-primary text-white px-1.5 py-0.5 rounded-full uppercase tracking-widest mt-1 w-fit shadow-md shadow-primary/20">Hoje</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {dayEvents.length > 0 && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200/50 shadow-sm">
                            <span className="material-symbols-outlined text-[14px] text-primary/60">event</span>
                            <span className="text-[11px] font-black text-text-secondary">
                              {dayEvents.length}
                            </span>
                          </div>
                        )}
                        <button 
                          onClick={() => updateURL('day', date)}
                          className="size-9 flex items-center justify-center rounded-xl bg-white text-text-secondary hover:text-primary transition-all shadow-sm border border-border-light hover:border-primary/20 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </button>
                      </div>
                    </div>
                    <div className={`p-3 flex flex-col gap-2 relative z-10 transition-all duration-300 ${!isCurrentMonth ? 'opacity-50 grayscale-[0.3]' : ''}`}>
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
            {/* Header Section for Week View */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 px-4 md:px-8 py-6 md:py-4 bg-slate-50/50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm mx-2 md:mx-8 mt-2 md:mt-4 transition-all duration-500 hover:shadow-md">
              <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto">
                <div className="size-14 md:size-18 rounded-[1.2rem] md:rounded-[1.5rem] bg-white shadow-xl shadow-primary/10 flex items-center justify-center ring-1 ring-primary/10 transition-transform hover:scale-105 duration-500 shrink-0">
                  <span className="material-symbols-outlined text-[28px] md:text-[36px] text-primary font-light">view_week</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg md:text-xl font-black text-text-main leading-tight">Visualização Semanal</h3>
                  <p className="hidden md:block text-[10px] text-text-secondary font-black uppercase tracking-[0.2em] opacity-60">Confira os compromissos da semana</p>
                  <p className="md:hidden text-[10px] text-text-secondary font-bold uppercase tracking-widest opacity-40 mt-1">Organize sua rotina semanal</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex flex-col flex-1">
              <div className="grid grid-cols-7 border-b border-border-light bg-slate-50 sticky top-[120px] md:top-[64px] z-[90] shadow-sm">
                {getDatesForWeek(currentDate).map((date, idx) => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div key={idx} className={`py-1.5 flex flex-col items-center gap-0.5 border-r border-border-light last:border-r-0 transition-all duration-300 ${
                    isToday ? 'bg-primary/10' : (isWeekend ? 'bg-orange-50/60' : 'bg-slate-50')
                  }`}>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                      isToday ? 'text-primary' : (isWeekend ? 'text-orange-600/80' : 'text-text-secondary')
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
                          isToday ? 'text-primary' : (isWeekend ? 'text-orange-600/80 hover:text-primary' : 'text-text-main hover:text-primary')
                        }`}
                      >
                        {date.getDate()}
                      </button>
                      {(eventsByDate[date.toDateString()] || []).length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateURL('day', date);
                          }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/50 border border-slate-200/50 group/badge hover:bg-primary/5 hover:border-primary/20 transition-all duration-300 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[10px] text-text-secondary/50 group-hover/badge:text-primary transition-colors">calendar_today</span>
                          <span className="text-[9px] font-black text-text-secondary group-hover/badge:text-primary transition-colors">
                            {(eventsByDate[date.toDateString()] || []).length}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
              <div className="grid grid-cols-7 flex-1 divide-x divide-border-light bg-white">
                {getDatesForWeek(currentDate).map((date, idx) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const dayEvents = eventsByDate[date.toDateString()] || [];
                  return (
                    <div
                      key={idx}
                      ref={date.toDateString() === weekTargetDateKey ? monthWeekTargetRef : (isToday ? todayRef : null)}
                      onDoubleClick={() => handleDayDoubleClick(date)}
                      className={`flex flex-col p-3 gap-2 min-h-[600px] cursor-default transition-all duration-300 relative ${scrollMarginClass} ${
                        isToday 
                          ? 'bg-primary/[0.06] shadow-inner' 
                          : isWeekend
                            ? 'bg-orange-50/40 hover:bg-orange-100/40'
                            : isCurrentMonth 
                              ? 'hover:bg-slate-50/30' 
                              : 'bg-slate-100/70'
                      }`}
                    >
                      {/* Subtil pattern for out-of-month days */}
                      {!isCurrentMonth && (
                        <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '4px 4px' }}></div>
                      )}
                      <div className={`flex flex-col gap-1.5 flex-1 group transition-all duration-300 ${!isCurrentMonth ? 'opacity-50 grayscale-[0.3]' : ''}`}>
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
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();

                return (
                  <div 
                    key={idx} 
                    ref={dateKey === weekTargetDateKey ? monthWeekTargetRef : (isToday ? todayRef : null)}
                    className={`rounded-3xl border border-border-light shadow-sm overflow-hidden transition-all duration-300 relative ${scrollMarginClass} ${
                      isToday 
                        ? 'bg-primary/[0.04] border-2 border-primary/20 shadow-xl shadow-primary/5 ring-4 ring-primary/5' 
                        : isWeekend
                          ? 'bg-orange-50/60 border-orange-200'
                          : isCurrentMonth 
                            ? 'bg-white hover:bg-slate-50/50' 
                            : 'bg-slate-100/70'
                    }`}
                  >
                    {/* Subtil pattern for out-of-month days */}
                    {!isCurrentMonth && !isToday && !isWeekend && (
                      <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '4px 4px' }}></div>
                    )}
                    {/* Weekend indicator mobile */}
                    {isWeekend && !isToday && (
                      <div className="absolute top-3 right-3 opacity-30">
                        <div className="size-2 rounded-full bg-orange-400/50"></div>
                      </div>
                    )}
                    {/* Glow effect for today mobile */}
                    {isToday && (
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-primary/[0.08] via-transparent to-transparent"></div>
                    )}
                    <div className={`px-4 py-4 flex items-center justify-between border-b border-slate-50 relative z-10 ${isToday ? 'bg-primary/5' : (isWeekend ? 'bg-orange-50/30' : 'bg-slate-50/50')}`}>
                      <div className="flex items-center gap-4">
                        <span className={`text-4xl font-black tracking-tighter transition-all duration-500 ${isToday ? 'text-primary' : (isWeekend ? 'text-orange-600/80' : 'text-text-main opacity-30')}`}>
                          {String(date.getDate()).padStart(2, '0')}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className={`text-[11px] font-black uppercase tracking-[0.15em] ${isToday ? 'text-primary' : (isWeekend ? 'text-orange-600/70' : 'text-text-secondary')}`}>
                            {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                          </span>
                          <span className={`text-[9px] font-medium uppercase tracking-widest ${isToday ? 'text-primary/60' : 'text-text-secondary/60'}`}>
                            {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                          </span>
                          {isToday && <span className="text-[8px] font-black bg-primary text-white px-1.5 py-0.5 rounded-full uppercase tracking-widest mt-1 w-fit shadow-md shadow-primary/20">Hoje</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {dayEvents.length > 0 && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200/50 shadow-sm">
                            <span className="material-symbols-outlined text-[14px] text-primary/60">event</span>
                            <span className="text-[11px] font-black text-text-secondary">
                              {dayEvents.length}
                            </span>
                          </div>
                        )}
                        <button 
                          onClick={() => updateURL('day', date)}
                          className="size-9 flex items-center justify-center rounded-xl bg-white text-text-secondary hover:text-primary transition-all shadow-sm border border-border-light hover:border-primary/20 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </button>
                      </div>
                    </div>
                    <div className={`p-3 flex flex-col gap-2 relative z-10 transition-all duration-300 ${!isCurrentMonth ? 'opacity-50 grayscale-[0.3]' : ''}`}>
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
                        <div className="py-2 flex items-center justify-center text-center">
                          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Sem eventos</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewType === 'day' && (() => {
          const isToday = currentDate.toDateString() === new Date().toDateString();
          const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
          
          return (
            <div 
              ref={isToday ? todayRef : dayViewRef}
              onDoubleClick={() => handleDayDoubleClick(currentDate)}
              className={`flex-1 flex flex-col cursor-default relative overflow-visible transition-all duration-500 ${scrollMarginClass} ${
                isToday 
                  ? 'bg-primary/[0.03] ring-inset ring-1 ring-primary/10' 
                  : (isWeekend ? 'bg-orange-50/20' : 'bg-white')
              }`}
            >
              {/* Header Section for Day View */}
              <div className={`flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 px-4 md:px-8 py-6 md:py-4 rounded-[1.5rem] md:rounded-[2rem] border shadow-sm mx-2 md:mx-8 mt-2 md:mt-4 transition-all duration-500 hover:shadow-md ${
                isWeekend && !isToday ? 'bg-orange-50/60 border-orange-200' : 'bg-slate-50/50 border-slate-100'
              }`}>
                <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto">
                  <div className="size-14 md:size-18 rounded-[1.2rem] md:rounded-[1.5rem] bg-white shadow-xl shadow-primary/10 flex items-center justify-center ring-1 ring-primary/10 transition-transform hover:scale-105 duration-500 shrink-0">
                    <span className={`material-symbols-outlined text-[28px] md:text-[36px] font-light ${isWeekend && !isToday ? 'text-orange-500' : 'text-primary'}`}>
                      {isWeekend ? 'event_repeat' : 'today'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-black text-text-main leading-tight">Compromissos do Dia</h3>
                    <p className="hidden md:block text-[10px] text-text-secondary font-black uppercase tracking-[0.2em] opacity-60">
                      {isWeekend ? 'Planejamento de final de semana' : 'Visualize os agendamentos de hoje'}
                    </p>
                    <p className="md:hidden text-[10px] text-text-secondary font-bold uppercase tracking-widest opacity-40 mt-1">Gestão diária de atividades</p>
                  </div>
                </div>
              </div>

              {/* Mobile Day Info Section */}
              <div className={`md:hidden flex flex-col items-center justify-center px-6 py-8 text-center border-b relative z-10 ${
                isWeekend && !isToday ? 'bg-orange-50/10 border-orange-50' : 'bg-white border-slate-100'
              }`}>
                <div className="flex flex-col items-center gap-2">
                  <h2 className={`text-4xl font-black tracking-tighter leading-none ${isWeekend && !isToday ? 'text-orange-600/80' : 'text-primary'}`}>
                    {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isWeekend && !isToday ? 'text-orange-600/60' : 'text-text-secondary'}`}>
                      {currentDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </p>
                    {isToday && (
                      <span className="px-2 py-0.5 bg-primary text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-md shadow-primary/20">
                        Hoje
                      </span>
                    )}
                  </div>
                </div>
                {(eventsByDate[currentDate.toDateString()] || []).length > 0 && (
                  <div className={`mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-sm ${
                    isWeekend && !isToday ? 'bg-orange-50/50 border-orange-100' : 'bg-primary/5 border-primary/10'
                  }`}>
                    <span className={`material-symbols-outlined text-sm ${isWeekend && !isToday ? 'text-orange-500/60' : 'text-primary/60'}`}>event_available</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isWeekend && !isToday ? 'text-orange-600/70' : 'text-primary'}`}>
                      {(eventsByDate[currentDate.toDateString()] || []).length} Eventos
                    </span>
                  </div>
                )}
              </div>

              {/* Glow effect for today day view */}
              {isToday && (
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent"></div>
              )}
              {isWeekend && !isToday && (
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-orange-400/[0.03] via-transparent to-transparent"></div>
              )}
            <div className={`hidden md:block sticky top-[120px] md:top-[64px] z-[90] border-b px-3 md:px-8 py-1.5 md:py-3 shadow-sm ${
              isWeekend && !isToday ? 'bg-orange-50/30 border-orange-50' : 'bg-white border-slate-100'
            }`}>
                <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
                  <div className="flex flex-col md:gap-1">
                    <div className="flex items-center gap-1.5 md:gap-3">
                      <h2 className={`text-lg md:text-3xl font-black tracking-tight ${isWeekend && !isToday ? 'text-orange-600/80' : 'text-primary'}`}>
                        {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                      </h2>
                      {(eventsByDate[currentDate.toDateString()] || []).length > 0 && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 md:px-3 md:py-1.5 rounded-lg md:rounded-xl border shadow-sm ${
                          isWeekend && !isToday ? 'bg-orange-100/50 border-orange-200' : 'bg-primary/5 border-primary/10'
                        }`}>
                          <span className={`material-symbols-outlined text-xs md:text-lg ${isWeekend && !isToday ? 'text-orange-500/60' : 'text-primary/60'}`}>event_available</span>
                          <span className={`text-[9px] md:text-xs font-black ${isWeekend && !isToday ? 'text-orange-600/70' : 'text-primary'}`}>
                            {(eventsByDate[currentDate.toDateString()] || []).length}
                            <span className="ml-1 opacity-60 text-[8px] md:text-[10px] uppercase tracking-wider hidden sm:inline">Eventos</span>
                          </span>
                        </div>
                      )}
                    </div>
                    <p className={`text-[9px] md:text-sm font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] ${isWeekend && !isToday ? 'text-orange-600/60' : 'text-text-secondary'}`}>
                      {currentDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </p>
                  </div>
                  {isToday && (
                    <span className="px-1.5 py-0.5 md:px-4 md:py-1.5 bg-primary text-white text-[7px] md:text-[10px] font-black uppercase tracking-widest rounded-full shadow-md md:shadow-lg shadow-primary/20 shrink-0">
                      Hoje
                    </span>
                  )}
                </div>
              </div>
              <div className={`p-4 md:p-8 max-w-4xl mx-auto w-full ${scrollMarginClass}`}>

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
                return dayEvents.map((event, index) => (
                    <div 
                      key={event.id} 
                      ref={index === 0 ? firstEventRef : null}
                      className={`hover:translate-x-1 transition-transform duration-300 ${scrollMarginClass}`}
                    >
                      {/* Desktop View */}
                      <div className="hidden md:block">
                        <CalendarEventCard
                          event={event}
                          user={user}
                          onCancel={handleCancelEvent}
                          detailed
                          setTooltipData={setTooltipData}
                          onSelect={setSelectedEvent}
                        />
                      </div>

                      {/* Mobile View - Optimized Layout */}
                      <div 
                        className={`md:hidden rounded-xl border shadow-sm p-3 flex gap-3 active:scale-[0.98] transition-transform ${event.status === 'canceled' ? 'bg-red-50/40 border-red-200' : 'bg-white border-slate-100'}`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        {/* Time Column */}
                        <div className="flex flex-col items-center justify-center px-2 border-r border-slate-50 min-w-[60px]">
                          <span className="text-sm font-black text-primary">
                            {new Date(event.date_start || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {event.date_end && (
                            <span className="text-[10px] font-medium text-text-secondary/60">
                              {new Date(event.date_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {/* Content Column */}
                        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                          <h4 className={`text-sm font-bold leading-tight break-words ${event.status === 'canceled' ? 'line-through text-red-800/60 decoration-red-300' : 'text-slate-800'}`}>
                            {event.title}
                          </h4>
                          
                          <div className="flex items-start gap-2 text-xs text-slate-500 mt-0.5">
                            {(event.expand?.location?.name || event.custom_location) && (
                              <div className="flex items-start gap-1 min-w-0">
                                <span className="material-symbols-outlined text-[14px] text-slate-400 flex-shrink-0 mt-0.5">location_on</span>
                                <span className="break-words leading-relaxed">
                                  {event.expand?.location?.name || event.custom_location}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Status Badges Row */}
                          <div className="flex items-center gap-1.5 mt-1">
                             {event.status === 'canceled' && (
                               <span className="text-[9px] font-black text-white bg-red-400 px-1.5 py-0.5 rounded border border-red-500 uppercase tracking-wide">
                                   CANCELADO
                               </span>
                             )}
                             {/* Transport */}
                             {event.transporte_suporte && (
                               <div className={`flex items-center justify-center size-5 rounded border ${
                                  event.transporte_status === 'confirmed' ? 'bg-green-50 border-green-200 text-green-600' : 
                                  (event.transporte_status === 'rejected' || event.transporte_status === 'refused') ? 'bg-red-50 border-red-200 text-red-600' :
                                  'bg-yellow-50 border-yellow-200 text-yellow-600'
                               }`} >
                                 <span className="material-symbols-outlined text-[12px]">directions_car</span>
                               </div>
                             )}

                             {/* Resources - Using helper logic inline since we are in map */}
                             {(() => {
                               const getStatus = (cat: string) => {
                                  const items = cat === 'ALMOXARIFADO' ? (event.almoxarifado_items || []) :
                                                cat === 'COPA' ? (event.copa_items || []) :
                                                (event.informatica_items || []);
                                  if (items.length === 0) return null;
                                  const confirmed = cat === 'ALMOXARIFADO' ? (event.almoxarifado_confirmed_items || []) :
                                                    cat === 'COPA' ? (event.copa_confirmed_items || []) :
                                                    (event.informatica_confirmed_items || []);
                                  return (confirmed.length === items.length) ? 'confirmed' : 'pending';
                               };

                               const almc = getStatus('ALMOXARIFADO');
                               const copa = getStatus('COPA');
                               const inf = getStatus('INFORMATICA');

                               return (
                                 <>
                                   {almc && (
                                     <div className={`flex items-center justify-center size-5 rounded border ${almc === 'confirmed' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-yellow-50 border-yellow-200 text-yellow-600'}`}>
                                       <span className="material-symbols-outlined text-[12px]">inventory_2</span>
                                     </div>
                                   )}
                                   {copa && (
                                     <div className={`flex items-center justify-center size-5 rounded border ${copa === 'confirmed' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-yellow-50 border-yellow-200 text-yellow-600'}`}>
                                       <span className="material-symbols-outlined text-[12px]">local_cafe</span>
                                     </div>
                                   )}
                                   {inf && (
                                     <div className={`flex items-center justify-center size-5 rounded border ${inf === 'confirmed' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-yellow-50 border-yellow-200 text-yellow-600'}`}>
                                       <span className="material-symbols-outlined text-[12px]">laptop_mac</span>
                                     </div>
                                   )}
                                 </>
                               );
                             })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        );
      })()}

        {viewType === 'agenda' && (
          <div className="flex-1 flex flex-col bg-white relative">
            {/* Header Section for Agenda View */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 px-4 md:px-8 py-6 md:py-10 bg-slate-50/50 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm mx-2 md:mx-8 mt-2 md:mt-8 transition-all duration-500 hover:shadow-md">
              <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto">
                <div className="size-14 md:size-24 rounded-[1.2rem] md:rounded-[2rem] bg-white shadow-xl shadow-primary/10 flex items-center justify-center ring-1 ring-primary/10 transition-transform hover:scale-105 duration-500 shrink-0">
                  <span className="material-symbols-outlined text-[28px] md:text-[48px] text-primary font-light">view_agenda</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg md:text-2xl font-black text-text-main leading-tight">Agenda do Mês</h3>
                  <p className="hidden md:block text-xs text-text-secondary font-black uppercase tracking-[0.2em] opacity-60">Visualize todos os compromissos</p>
                  <p className="md:hidden text-[10px] text-text-secondary font-bold uppercase tracking-widest opacity-40 mt-1">Visão geral de compromissos</p>
                </div>
              </div>
            </div>

            <div ref={agendaViewRef} className={`p-4 md:p-8 flex flex-col gap-12 max-w-5xl mx-auto w-full ${scrollMarginClass}`}>
              {(() => {
                 // Filter events for the current month and year using filteredEvents instead of events
                 const monthEvents = filteredEvents.filter(e => {
                    const eDate = new Date(e.date_start || '');
                    return eDate.getMonth() === currentDate.getMonth() &&
                           eDate.getFullYear() === currentDate.getFullYear();
                 }).sort((a, b) => new Date(a.date_start || '').getTime() - new Date(b.date_start || '').getTime());

                 if (monthEvents.length === 0) {
                    return (
                        <div className="py-20 flex flex-col items-center justify-center text-center gap-4 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                          <span className="material-symbols-outlined text-5xl text-slate-300">event_busy</span>
                          <p className="text-slate-500 font-bold">Nenhum evento futuro encontrado</p>
                        </div>
                    );
                 }

                 // Group the filtered and sorted events by date
                 const groupedEventsByDate: { [key: string]: CalendarEvent[] } = {};
                 monthEvents.forEach(event => {
                    const dateKey = new Date(event.date_start || '').toDateString();
                    if (!groupedEventsByDate[dateKey]) groupedEventsByDate[dateKey] = [];
                    groupedEventsByDate[dateKey].push(event);
                 });

                 return Object.entries(groupedEventsByDate).map(([dateStr, dayEvents]) => {
                    const date = new Date(dayEvents[0].date_start || '');
                    const isToday = new Date().toDateString() === date.toDateString();
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                    
                    return (
                        <div 
                            key={dateStr} 
                            ref={dateStr === agendaTargetDateKey ? agendaTargetRef : (isToday ? todayRef : null)}
                            className={`flex flex-col md:flex-row gap-6 md:gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500 p-6 -mx-4 rounded-3xl transition-all relative overflow-hidden ${scrollMarginClass} ${
                                isToday 
                                    ? 'bg-primary/[0.04] border-2 border-primary/20 relative shadow-xl shadow-primary/5 ring-4 ring-primary/5' 
                                    : isWeekend && isCurrentMonth
                                        ? 'bg-orange-50/40 md:bg-orange-50/60 border-2 border-orange-100/50 hover:bg-orange-50/60 md:hover:bg-orange-50/80'
                                        : isCurrentMonth 
                                            ? 'hover:bg-slate-50/50'
                                            : 'bg-slate-100/70 opacity-80'
                            }`}
                        >
                            {/* Subtil pattern for out-of-month days */}
                            {!isCurrentMonth && (
                                <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '4px 4px' }}></div>
                            )}
                            {/* Glow effect for today agenda */}
                            {isToday && (
                              <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-primary/[0.08] via-transparent to-transparent"></div>
                            )}
                            {/* Glow effect for weekend agenda */}
                            {isWeekend && !isToday && isCurrentMonth && (
                              <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-orange-500/[0.03] via-transparent to-transparent"></div>
                            )}
                            <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-0 md:w-32 shrink-0 relative z-10">
                                <span className={`text-4xl md:text-5xl font-black transition-transform duration-500 ${
                                    isToday 
                                        ? 'text-primary scale-110 drop-shadow-md' 
                                        : isWeekend && isCurrentMonth
                                            ? 'text-orange-600/80'
                                            : isCurrentMonth 
                                                ? 'text-text-main opacity-30' 
                                                : 'text-slate-400'
                                }`}>
                                    {String(date.getDate()).padStart(2, '0')}
                                </span>
                                <div className="flex flex-col leading-tight">
                                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${
                                        isToday 
                                            ? 'text-primary' 
                                            : isWeekend && isCurrentMonth
                                                ? 'text-orange-600/70'
                                                : 'text-text-secondary'
                                    }`}>
                                        {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                                    </span>
                                    <span className={`text-[9px] font-medium uppercase tracking-widest ${
                                        isToday 
                                            ? 'text-primary/60' 
                                            : isWeekend && isCurrentMonth
                                                ? 'text-orange-600/50'
                                                : 'text-text-secondary/60'
                                    }`}>
                                      {date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')}
                                    </span>
                                    {isToday && <span className="text-[8px] font-black bg-primary text-white px-1.5 py-0.5 rounded-full uppercase tracking-widest mt-1 w-fit shadow-md shadow-primary/20">Hoje</span>}
                                    {isWeekend && !isToday && isCurrentMonth && (
                                        <span className="text-[7px] font-black text-orange-600/60 uppercase tracking-widest mt-1 flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-orange-500/50"></span>
                                            Fim de semana
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className={`flex-1 flex flex-col gap-4 border-l-2 border-slate-50 pl-6 md:pl-12 pb-8 transition-all duration-300 ${!isCurrentMonth ? 'opacity-50 grayscale-[0.3]' : ''}`}>
                                {dayEvents.map((event) => (
                                    <div 
                                        key={event.id} 
                                        ref={isToday ? firstEventRef : null}
                                        className={`hover:translate-x-1 transition-transform duration-300 ${scrollMarginClass}`}
                                    >
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
        isMobileOrTablet={isMobileOrTablet}
      />

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => {
            setSelectedEvent(null);
            setInitialChatOpen(false);
            setInitialTab('details');

            // Limpar parâmetros de URL ao fechar o modal
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('eventId');
            newParams.delete('openChat');
            newParams.delete('tab');
            newParams.delete('from');
            setSearchParams(newParams, { replace: true });

            // Scroll para o topo da página (especialmente se veio da busca global)
            window.scrollTo({ top: 0, behavior: 'smooth' });

            if (returnPath) {
              const path = returnPath;
              setReturnPath(null);
              
              // Se o path tiver parâmetros, usá-los, senão tentar manter a aba histórico
              if (path.includes('/almoxarifado')) {
                navigate(`${path}${path.includes('?') ? '&' : '?'}view=history`);
              } else if (path.includes('/informatica')) {
                navigate(`${path}${path.includes('?') ? '&' : '?'}view=history`);
              } else if (path.includes('/transporte')) {
                navigate(`${path}${path.includes('?') ? '&' : '?'}view=history`);
              } else {
                navigate(path);
              }
            }
          }}
          onCancel={handleCancelEvent}
          onDelete={handleDeleteEvent}
          user={user as any}
          initialChatOpen={initialChatOpen}
          initialTab={initialTab}
        />
      )}

      {refusalModalOpen && (
        <RefusalModal
          onClose={() => {
            setRefusalModalOpen(false);
            setEventToCancel(null);
          }}
          onConfirm={handleConfirmCancellation}
          loading={processingCancellation}
          title="Cancelar Evento"
          description={`Por favor, informe o motivo do cancelamento do evento "${eventToCancel?.title}". Esta ação notificará todos os participantes.`}
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
  </div>
);
};

const CalendarTooltip: React.FC<{ 
  event: CalendarEvent | undefined, 
  visible: boolean, 
  x: number, 
  y: number, 
  height: number,
  isMobileOrTablet: boolean
}> = ({ event: propEvent, visible, x, y, height, isMobileOrTablet }) => {
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const [isRendered, setIsRendered] = React.useState(false);
  const [opacity, setOpacity] = React.useState(0);
  const [event, setEvent] = React.useState<CalendarEvent | null>(null);

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
  }, [isRendered, x, y, height, event]);

  if (!isRendered || !event) return null;

  // Mobile/Tablet Check: Don't render tooltip on small screens
  if (isMobileOrTablet) return null;

  const startDate = new Date(event.date_start || '');
  const endDate = new Date(event.date_end || event.date_start || '');
  const creatorInitial = (event.expand?.user?.name || 'S')[0].toUpperCase();

  // Helper to determine status for Almc/Copa/Inf
  const getRequestStatus = (category: 'ALMOXARIFADO' | 'COPA' | 'INFORMATICA') => {
    // Priority 1: Check actual requests (real-time data passed from parent)
    const categoryRequests = event.almac_requests?.filter((r) => r.expand?.item?.category === category) || [];
    
    if (categoryRequests.length > 0) {
      const allConfirmed = categoryRequests.every((r) => r.status === 'approved');
      const anyRejected = categoryRequests.some((r) => r.status === 'rejected');

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
            const r = roleValue.toUpperCase();
            const level = INVOLVEMENT_LEVELS.find(l => l.value === r);
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

  const isCancelled = event.status === 'canceled';

  return (
    createPortal(
    <div
      ref={tooltipRef}
      style={{ 
        left: `${position.left}px`, 
        top: `${position.top}px`,
        opacity: opacity,
        transform: `scale(${0.95 + (opacity * 0.05)}) translateY(${(1 - opacity) * 10}px)`,
        transition: 'opacity 200ms ease-out, transform 200ms ease-out'
      }}
      className={`absolute z-[10000] w-[280px] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden pointer-events-none ${isCancelled ? 'border-2 border-red-100 ring-4 ring-red-50' : 'border border-gray-100/50'}`}
    >
      <div className="p-4 space-y-3">
        {/* Header Section */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-col min-w-0">
            <h4 className={`text-base font-black leading-tight ${isCancelled ? 'text-red-500 line-through decoration-2' : 'text-primary'}`}>
              {event.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary/60 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                {event.type || 'Evento'}
              </span>
              {isCancelled && (
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-500 text-white shadow-sm shadow-red-200 uppercase tracking-wider">Cancelado</span>
              )}
            </div>
          </div>
          <div className={`size-8 rounded-full flex items-center justify-center font-black text-xs shadow-sm shrink-0 ${isCancelled ? 'bg-red-100 text-red-500 border border-red-200' : 'bg-primary/5 border border-primary/10 text-primary'}`}>
            {creatorInitial}
          </div>
        </div>

        {/* Creator Info */}
        <div className="flex items-center gap-2 px-1 pb-1">
            <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                <span className="material-symbols-outlined text-[14px] text-primary/60">person</span>
                <span>Criado por:</span>
            </div>
            <span className="text-[10px] font-bold text-text-main truncate">
                {event.expand?.user?.name || 'Usuário Desconhecido'}
            </span>
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

          {event.event_responsibility && (
            <div className="flex flex-col gap-0.5 px-1">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base text-slate-400">
                  {event.event_responsibility.includes('EXTERNO') ? 'public' : 'domain'}
                </span>
                <span className="text-[11px] font-bold text-text-main truncate">
                  {RESPONSIBILITY_LEVELS.find(l => l.value === event.event_responsibility)?.label}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 pl-7 leading-tight">
                {RESPONSIBILITY_LEVELS.find(l => l.value === event.event_responsibility)?.description}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2.5 px-1">
            <span className="material-symbols-outlined text-base text-slate-400">groups</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-text-main">
                {totalConfirmed} {totalConfirmed === 1 ? 'Participante' : 'Participantes'}
              </span>
              {event.event_responsibility !== 'EXTERNO_COMPROMISSO' && getEstimatedParticipants(event) > 0 && (
                   <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-text-secondary bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
                     <span className="material-symbols-outlined text-[12px] opacity-70">groups</span>
                     <span>Est. {getEstimatedParticipants(event)} pessoas</span>
                   </div>
               )}
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
    ) );
};

interface CalendarEventCardProps {
  event: CalendarEvent;
  user: any; // Using any to avoid User/UsersResponse conflict while keeping it functional
  onCancel: (id: string, title: string, participants: string[]) => void;
  setTooltipData: (data: { event: CalendarEvent, x: number, y: number, height: number } | null) => void;
  detailed?: boolean;
  onSelect: (event: CalendarEvent) => void;
}

const CalendarEventCard: React.FC<CalendarEventCardProps> = ({ event, user, onCancel, setTooltipData, detailed, onSelect }) => {
  const isCancelled = event.status === 'canceled';
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  
  const getCategoryStatus = (category: 'ALMOXARIFADO' | 'COPA' | 'INFORMATICA') => {
    // Priority 1: Check actual requests (real-time data)
    const categoryRequests = event.almac_requests?.filter((r) => {
        let cat = r.expand?.item?.category;
        // Normalize categories
        if (cat === 'ALMC') cat = 'ALMOXARIFADO';
        if (cat === 'INFO') cat = 'INFORMATICA';
        return cat === category;
    }) || [];
    
    if (categoryRequests.length > 0) {
      const allConfirmed = categoryRequests.every((r) => r.status === 'approved');
      const anyRejected = categoryRequests.some((r) => r.status === 'rejected');

      if (anyRejected) return 'rejected';
      if (allConfirmed) return 'confirmed';
      return 'pending';
    }

    // Priority 2: Fallback to event summary fields (static data from fetchEvents)
    const items = category === 'ALMOXARIFADO' ? (event.almoxarifado_items || []) :
                  category === 'COPA' ? (event.copa_items || []) :
                  (event.informatica_items || []);
                  
    if (items.length === 0) return null;

    const confirmed = category === 'ALMOXARIFADO' ? (event.almoxarifado_confirmed_items || []) :
                      category === 'COPA' ? (event.copa_confirmed_items || []) :
                      (event.informatica_confirmed_items || []);

    return (confirmed.length === items.length && items.length > 0) ? 'confirmed' : 'pending';
  };

  const getStatusColor = (status: string | null) => {
    if (status === 'confirmed') return 'text-green-600 bg-green-50 border-green-100';
    if (status === 'rejected') return 'text-red-600 bg-red-50 border-red-100';
    return 'text-yellow-600 bg-yellow-50 border-yellow-100';
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Clear any existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Set a delay of 600ms before showing the tooltip
    timeoutRef.current = setTimeout(() => {
      setTooltipData({
        event,
        x: rect.left + rect.width / 2,
        y: rect.top,
        height: rect.height
      });
    }, 600);
  };

  const handleMouseLeave = () => {
    // Clear timeout if mouse leaves before it triggers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTooltipData(null);
  };

  const almcStatus = getCategoryStatus('ALMOXARIFADO');
  const copaStatus = getCategoryStatus('COPA');
  const infStatus = getCategoryStatus('INFORMATICA');

  // Helper to determine involvement level
  const getInvolvementLevel = () => {
    if (!user?.id) return null;
    if (event.user === user.id) return { label: 'Criador', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
    
    // Check role in participants_roles first
    const roleValue = (event.participants_roles?.[user.id] || '').toUpperCase();
    if (roleValue) {
        if (roleValue === 'ORGANIZADOR' || roleValue === 'COORGANIZADOR') return { label: 'Organizador', color: 'bg-blue-50 text-blue-700 border-blue-100' };
        if (roleValue === 'PARTICIPANTE') return { label: 'Participante', color: 'bg-slate-50 text-slate-700 border-slate-100' };
        
        // Legacy or specific roles
        if (roleValue === 'COORDENADOR') return { label: 'Coordenação', color: 'bg-purple-50 text-purple-700 border-purple-100' };
        if (roleValue === 'CONVIDADO') return { label: 'Convidado', color: 'bg-blue-50 text-blue-700 border-blue-100' };
        if (roleValue === 'APOIO') return { label: 'Apoio', color: 'bg-slate-50 text-slate-700 border-slate-100' };
    }
    
    // Check if user is in participants list
    const isParticipant = event.participants?.includes(user.id);
    if (isParticipant) {
        return { label: 'Participante', color: 'bg-slate-50 text-slate-700 border-slate-100' };
    }
    
    // Check specific roles based on sector
    if (user?.role === 'TRA' && event.transporte_suporte) return { label: 'Transporte', color: 'bg-amber-50 text-amber-700 border-amber-100' };
    if (user?.role === 'ALMC' && (almcStatus || copaStatus)) return { label: 'Logística', color: 'bg-orange-50 text-orange-700 border-orange-100' };
    if (user?.role === 'DCA' && infStatus) return { label: 'Técnico', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' };

    return null;
  };

  const involvement = getInvolvementLevel();
  const creatorName = event.expand?.user?.name || 'Desconhecido';
  const participantCount = (event.expand?.participants?.length || 0) + 1; // +1 for creator

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setTooltipData(null);
        onSelect(event);
      }}
      className={`w-full border-l-[3px] rounded-lg px-3 py-3 cursor-pointer transition-all duration-200 hover:translate-x-0.5 relative group ${isCancelled
        ? 'bg-red-50/40 border-red-200 hover:border-red-300'
        : 'bg-white border-primary/40 hover:border-primary shadow-sm hover:shadow-md'
        } ${detailed ? 'p-5' : ''}`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          {/* Responsabilidade - Visual indicador no card */}
            {event.event_responsibility && (
              <div className={`absolute top-2 right-2 flex items-center justify-center size-5 rounded-full border text-slate-400 group-hover:text-indigo-500 transition-colors ${isCancelled ? 'bg-white/50 border-red-100' : 'bg-slate-50 border-slate-100'}`} title={`${RESPONSIBILITY_LEVELS.find(l => l.value === event.event_responsibility)?.label}\n${RESPONSIBILITY_LEVELS.find(l => l.value === event.event_responsibility)?.description}`}>
                <span className="material-symbols-outlined text-[12px]">
                  {event.event_responsibility.includes('EXTERNO') ? 'public' : 'domain'}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5 min-w-0">
             <p className={`font-bold leading-tight ${detailed ? 'text-lg' : 'text-xs truncate'} ${isCancelled ? 'text-red-800/60 line-through decoration-red-300' : 'text-slate-800'}`}>
               {event.title}
             </p>
             {/* Mobile/Tablet Extra Details */}
             {!detailed && (
               <div className="flex md:hidden flex-wrap items-center gap-1.5 mt-1">
                  {involvement && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${involvement.color}`}>
                          {involvement.label}
                      </span>
                  )}
                  {isCancelled && (
                    <span className="text-[9px] font-black text-white bg-red-400 px-1.5 py-0.5 rounded border border-red-500 uppercase tracking-wide">
                        CANCELADO
                    </span>
                  )}
                  <span className="text-[9px] font-medium text-slate-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]">person</span>
                      {creatorName.split(' ')[0]}
                  </span>
               </div>
             )}
          </div>

          {!detailed && (
             <div className="flex flex-col items-end gap-1">
                 <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                   {new Date(event.date_start || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                 </span>
                 {/* Participant Count Badge */}
                 <div className="flex md:hidden items-center gap-0.5 text-[9px] font-bold text-slate-400">
                    <span className="material-symbols-outlined text-[10px]">group</span>
                    {participantCount}
                    {event.event_responsibility !== 'EXTERNO_COMPROMISSO' && event.estimated_participants && (
                        <span className="ml-0.5 text-[8px] opacity-70">(Est. {event.estimated_participants})</span>
                    )}
                 </div>
             </div>
          )}
        </div>

        {detailed && (
          <div className="flex flex-col gap-2 mt-1">
             <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
                 <div className="flex items-center gap-1.5">
                   <span className="material-symbols-outlined text-base text-primary/70">schedule</span>
                   <span>
                     {new Date(event.date_start || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                     {event.date_end && ` - ${new Date(event.date_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                   </span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <span className="material-symbols-outlined text-base text-primary/70">location_on</span>
                   <span className="break-words">{event.expand?.location?.name || event.custom_location || 'Local não definido'}</span>
                 </div>
             </div>

             {event.description && (
               <div className="mt-2 text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/50">
                 <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-1">Descrição</p>
                 <div className="whitespace-pre-wrap break-words">{event.description}</div>
               </div>
             )}

             {event.observacoes && event.observacoes !== event.description && (
               <div className="mt-2 text-xs text-amber-700/80 leading-relaxed bg-amber-50/30 p-2.5 rounded-lg border border-amber-100/50">
                 <p className="font-bold text-[10px] uppercase tracking-wider text-amber-500/60 mb-1">Observações Internas</p>
                 <div className="whitespace-pre-wrap break-words">{event.observacoes}</div>
               </div>
             )}

             <div className="flex flex-wrap items-center gap-3 pt-3 mt-1 border-t border-slate-50">
                <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-slate-500">{creatorName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Criado por</span>
                        <span className="text-[10px] font-bold text-slate-700 leading-none">{creatorName}</span>
                    </div>
                </div>

                {involvement && (
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${involvement.color}`}>
                        {involvement.label}
                    </div>
                )}

                <div className="flex items-center gap-1.5 ml-auto pl-3 border-l border-slate-100">
                    <span className="material-symbols-outlined text-[14px] text-slate-400">group</span>
                    <span className="text-[10px] font-bold text-slate-600">
                        {participantCount}
                        {event.event_responsibility !== 'EXTERNO_COMPROMISSO' && event.estimated_participants && (
                            <span className="text-slate-400 font-medium ml-1">
                                (Est. {event.estimated_participants})
                            </span>
                        )}
                    </span>
                </div>
             </div>
          </div>
        )}

        {/* Status Indicators Row */}
        <div className="flex items-center gap-1.5 mt-0.5 min-h-[16px]">
           {/* Transport */}
           {event.transporte_suporte && (
             <div className={`flex items-center justify-center size-5 rounded border ${
                event.transporte_status === 'confirmed' ? 'bg-green-50 border-green-200 text-green-600' : 
                (event.transporte_status === 'rejected' || event.transporte_status === 'refused') ? 'bg-red-50 border-red-200 text-red-600' :
                'bg-yellow-50 border-yellow-200 text-yellow-600'
             }`}>
               <span className="material-symbols-outlined text-[12px]">directions_car</span>
             </div>
           )}

           {/* Resources */}
           {almcStatus && (
             <div className={`flex items-center justify-center size-5 rounded border ${getStatusColor(almcStatus)}`}>
               <span className="material-symbols-outlined text-[12px]">inventory_2</span>
             </div>
           )}
           {copaStatus && (
             <div className={`flex items-center justify-center size-5 rounded border ${getStatusColor(copaStatus)}`}>
               <span className="material-symbols-outlined text-[12px]">local_cafe</span>
             </div>
           )}
           {infStatus && (
             <div className={`flex items-center justify-center size-5 rounded border ${getStatusColor(infStatus)}`}>
               <span className="material-symbols-outlined text-[12px]">laptop_mac</span>
             </div>
           )}

           {/* Cancelled Label */}
           {isCancelled && (
             <span className="text-[9px] font-black text-white uppercase tracking-wider bg-red-500 px-2 py-0.5 rounded shadow-sm shadow-red-200 ml-auto">
               Cancelado
             </span>
           )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
