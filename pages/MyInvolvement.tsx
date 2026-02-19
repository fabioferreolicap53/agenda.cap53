import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, isPast, isFuture, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMySpace, MySpaceEvent } from '../hooks/useMySpace';
import { useAuth } from '../components/AuthContext';
import EventDetailsModal from '../components/EventDetailsModal';
import { deleteEventWithCleanup } from '../lib/eventUtils';
import { notifyEventStatusChange } from '../lib/notificationUtils';
import { pb } from '../lib/pocketbase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const MyInvolvement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { events, loading, stats, analytics, refresh } = useMySpace();
  const [activeTab, setActiveTab] = useState<'all' | 'organizer' | 'coorganizer' | 'participant' | 'pending' | 'rejected'>('all');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const handleCancelEvent = async (eventId: string, title: string, participants: string[]) => {
    const reason = prompt('Por que deseja cancelar este evento?');
    if (reason === null) return;

    try {
      // 1. Atualizar status
      await pb.collection('agenda_cap53_eventos').update(eventId, {
        status: 'cancelled',
        cancel_reason: reason
      });

      // 2. Buscar evento atualizado e notificar todos os envolvidos
      // (Participantes, Organizadores, Setores com solicitações aprovadas)
      try {
        const updatedEvent = await pb.collection('agenda_cap53_eventos').getOne(eventId);
        if (user) {
          await notifyEventStatusChange(updatedEvent, 'cancelled', reason, user.id);
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

  const handleDeleteEvent = async (event: any) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o evento "${event.title}"?`)) return;

    try {
        // Use client-side cleanup utility to delete notifications first,
        // then delete the event. This provides redundancy to the server-side hook.
        await deleteEventWithCleanup(event.id, user?.id);
        
        alert('Evento excluído com sucesso.');
        setSelectedEvent(null);
        refresh();
    } catch (error: any) {
        console.error('Error deleting event:', error);
        const msg = error.data?.message || error.message || 'Erro desconhecido';
        alert(`Erro ao excluir evento: ${msg}`);
    }
  };

  const handleOpenEventInCalendar = (event: any) => {
    const eventDate = new Date(event.date_start);
    const dateStr = eventDate.toISOString().split('T')[0];
    navigate(`/calendar?date=${dateStr}&view=agenda&eventId=${event.id}&tab=details`);
  };

  const filteredEvents = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const searchTerm = (params.get('search') || '').toLowerCase();
    
    let result = events;

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

    if (searchTerm) {
      result = result.filter(e => 
        (e.title || '').toLowerCase().includes(searchTerm) ||
        (e.description || '').toLowerCase().includes(searchTerm) ||
        (e.location || '').toLowerCase().includes(searchTerm) ||
        (e.nature || '').toLowerCase().includes(searchTerm) ||
        (e.category || '').toLowerCase().includes(searchTerm)
      );
    }
    
    return result;
  }, [events, activeTab, location.search]);

  const getStatusBadge = (event: MySpaceEvent) => {
    if (event.participationStatus === 'pending') {
      return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase animate-pulse">Convite Pendente</span>;
    }
    if (event.requestStatus === 'pending') {
      return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase animate-pulse">Solicitação Pendente</span>;
    }

    if (event.participationStatus === 'rejected') {
      return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase">Convite Recusado</span>;
    }
    if (event.requestStatus === 'rejected') {
      return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">Solicitação Recusada</span>;
    }

    const start = getSafeDate(event.date_start);
    
    if (event.status === 'canceled') {
      return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase">Cancelado</span>;
    }
    
    if (isPast(getSafeDate(event.date_end))) {
      return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">Concluído</span>;
    }

    if (isToday(start)) {
      return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase animate-pulse">Hoje</span>;
    }

    if (isFuture(start)) {
      return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase">Agendado</span>;
    }

    return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">Ativo</span>;
  };

  const getRoleIcon = (event: MySpaceEvent) => {
    if (event.requestStatus === 'pending' || event.participationStatus === 'pending') return 'hourglass_top';
    if (event.requestStatus === 'rejected' || event.participationStatus === 'rejected') return 'person_off';

    const role = (event.userRole || '').toUpperCase();
    switch (role) {
      case 'ORGANIZADOR': return 'assignment_ind';
      case 'COORGANIZADOR': return 'group_work';
      case 'PARTICIPANTE': return 'person';
      default: return 'event';
    }
  };

  const getRoleBadge = (event: MySpaceEvent) => {
    const role = (event.userRole || '').toUpperCase();
    const isCreator = event.type === 'created';
    const isRejected = event.requestStatus === 'rejected' || event.participationStatus === 'rejected';

    let roleText = 'Participante';
    let roleIcon = 'person';
    let roleClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';

    if (role === 'ORGANIZADOR') {
      roleText = 'Organizador';
      roleIcon = 'assignment_ind';
      roleClass = 'bg-blue-50 text-blue-700 border-blue-100';
    } else if (role === 'COORGANIZADOR') {
      roleText = 'Coorganizador';
      roleIcon = 'group_work';
      roleClass = 'bg-green-50 text-green-700 border-green-100';
    }

    if (isRejected) {
      roleClass = 'bg-slate-50 text-slate-400 border-slate-200 opacity-60';
      roleIcon = 'person_off';
    }

    const baseBadgeClass = "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-colors";

    return (
      <>
        <span className={`${baseBadgeClass} ${roleClass}`}>
          <span className="material-symbols-outlined text-[14px]">{roleIcon}</span>
          {roleText}
        </span>
        {isCreator && (
          <span className={`${baseBadgeClass} border-slate-200 bg-slate-50 text-slate-600`}>
            <span className="material-symbols-outlined text-[14px]">edit_calendar</span>
            Criador
          </span>
        )}
      </>
    );
  };

  const getSafeDate = (dateStr: string | undefined) => {
    if (!dateStr) return new Date();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Carregando seu espaço...</p>
      </div>
    );
  }

  const safeAnalytics = analytics || { byType: [], byNature: [], byTime: [], byResources: [] };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Quick Stats Group - Filling the space with professional metrics */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="group bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-w-[150px] transition-all hover:border-indigo-100 hover:shadow-md">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1 group-hover:text-indigo-400 transition-colors">Total de Eventos</span>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-slate-900 leading-none">{events.length}</span>
              <span className="text-[10px] font-bold text-slate-400 mb-0.5">atividades</span>
            </div>
          </div>

          <div className="group bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-w-[150px] transition-all hover:border-blue-100 hover:shadow-md">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.15em] mb-1">Como Criador</span>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-blue-600 leading-none">{stats.totalCreated}</span>
              <span className="text-[10px] font-bold text-slate-400 mb-0.5">eventos</span>
            </div>
          </div>

          {stats.invitesPending > 0 && (
            <div className="group bg-amber-50/50 px-5 py-3 rounded-2xl border border-amber-200 shadow-sm flex flex-col min-w-[150px] animate-in fade-in zoom-in duration-500 hover:bg-amber-50 transition-all">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.15em] mb-1">Convites Pendentes</span>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-black text-amber-700 leading-none">{stats.invitesPending}</span>
                <span className="material-symbols-outlined text-amber-500 text-sm mb-1 animate-pulse">notification_important</span>
              </div>
            </div>
          )}
          
          {stats.requestsPending > 0 && (
            <div className="group bg-blue-50/50 px-5 py-3 rounded-2xl border border-blue-200 shadow-sm flex flex-col min-w-[150px] animate-in fade-in zoom-in duration-500 hover:bg-blue-50 transition-all">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.15em] mb-1">Solicitações Ativas</span>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-black text-blue-700 leading-none">{stats.requestsPending}</span>
                <span className="material-symbols-outlined text-blue-400 text-sm mb-1">outbound</span>
              </div>
            </div>
          )}
        </div>

        {/* Premium Action Controls */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm self-end lg:self-auto">
          <button 
            onClick={() => navigate('/create-event')}
            className="hidden sm:flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all font-black text-[11px] uppercase tracking-wider bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
            Nova Atividade
          </button>

          <div className="hidden sm:block w-px h-8 bg-slate-100 mx-1" />

          <button 
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all font-black text-[11px] uppercase tracking-wider ${
              showAnalytics 
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{showAnalytics ? 'view_list' : 'analytics'}</span>
            {showAnalytics ? 'Ver Lista' : 'Visão Analítica'}
          </button>
          
          <div className="w-px h-8 bg-slate-200 mx-1" />
          
          <button 
            onClick={() => refresh()}
            className="group size-11 flex items-center justify-center bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-100 rounded-xl transition-all text-slate-400 hover:text-indigo-600 shadow-sm"
            title="Sincronizar dados"
          >
            <span className="material-symbols-outlined transition-transform duration-1000 group-hover:rotate-180">refresh</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-slate-400 text-xl">dashboard</span>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Visão Geral</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Criados', value: stats.totalCreated, icon: 'edit_calendar', color: 'text-slate-600', bg: 'bg-slate-50' },
              { label: 'Organizador', value: stats.organizer, icon: 'assignment_ind', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Coorganizador', value: stats.coorganizer, icon: 'group_work', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Participante', value: stats.participant, icon: 'person', color: 'text-indigo-600', bg: 'bg-indigo-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-3 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group text-center flex flex-col justify-center items-center h-full">
                <div className={`size-10 mx-auto rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                  <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                </div>
                <p className="text-2xl font-black text-slate-900 leading-none mb-1">{stat.value}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate w-full px-1" title={stat.label}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-amber-400 text-xl">mail</span>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Convites Enviados</h2>
          </div>
          <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm space-y-2 h-full max-h-[260px] flex flex-col justify-center">
            {[
              { label: 'Pendentes', value: stats.sentInvitesPending, icon: 'mail', color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Aceitos', value: stats.sentInvitesAccepted, icon: 'mark_email_read', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Recusados', value: stats.sentInvitesRejected, icon: 'mail_lock', color: 'text-red-600', bg: 'bg-red-50' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`size-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-600">{stat.label}</span>
                </div>
                <span className="text-xl font-black text-slate-900">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-amber-400 text-xl">inbox</span>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Convites Recebidos</h2>
          </div>
          <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm space-y-2 h-full max-h-[260px] flex flex-col justify-center">
            {[
              { label: 'Pendentes', value: stats.invitesPending, icon: 'mail', color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Aceitos', value: stats.invitesAccepted, icon: 'mark_email_read', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Recusados', value: stats.invitesRejected, icon: 'mail_lock', color: 'text-red-600', bg: 'bg-red-50' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`size-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-600">{stat.label}</span>
                </div>
                <span className="text-xl font-black text-slate-900">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-blue-400 text-xl">send</span>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Solicitações Enviadas</h2>
          </div>
          <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm space-y-2 h-full max-h-[260px] flex flex-col justify-center">
            {[
              { label: 'Pendentes', value: stats.requestsPending, icon: 'send', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Aceitas', value: stats.requestsAccepted, icon: 'task_alt', color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Recusadas', value: stats.requestsRejected, icon: 'cancel_schedule_send', color: 'text-slate-600', bg: 'bg-slate-50' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`size-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-600">{stat.label}</span>
                </div>
                <span className="text-xl font-black text-slate-900">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-purple-400 text-xl">inbox_customize</span>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Solicitações Recebidas</h2>
          </div>
          <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm space-y-2 h-full max-h-[260px] flex flex-col justify-center">
            {[
              { label: 'Pendentes', value: stats.receivedRequestsPending, icon: 'hourglass_top', color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Aceitas', value: stats.receivedRequestsAccepted, icon: 'check_circle', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Recusadas', value: stats.receivedRequestsRejected, icon: 'cancel', color: 'text-red-600', bg: 'bg-red-50' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`size-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-600">{stat.label}</span>
                </div>
                <span className="text-xl font-black text-slate-900">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {showAnalytics ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
            {safeAnalytics.byType.length > 0 ? (
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-900">Distribuição por Tipo</h3>
                    <p className="text-xs text-slate-500 font-medium">Categorização dos seus eventos confirmados</p>
                  </div>
                  <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <span className="material-symbols-outlined">category</span>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={safeAnalytics.byType}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {safeAnalytics.byType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center py-20">
                <span className="material-symbols-outlined text-4xl text-slate-200 mb-4">pie_chart_off</span>
                <p className="text-slate-500 font-medium">Sem dados para tipos de eventos</p>
              </div>
            )}

            {safeAnalytics.byTime.length > 0 ? (
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-900">Histórico Temporal</h3>
                    <p className="text-xs text-slate-500 font-medium">Frequência de eventos nos últimos meses</p>
                  </div>
                  <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <span className="material-symbols-outlined">timeline</span>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={safeAnalytics.byTime}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#6366f1" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center py-20">
                <span className="material-symbols-outlined text-4xl text-slate-200 mb-4">show_chart</span>
                <p className="text-slate-500 font-medium">Sem histórico temporal disponível</p>
              </div>
            )}

            {/* Removido o gráfico de Natureza conforme solicitado, pois já está definido no cabeçalho */}

            {safeAnalytics.byResources.length > 0 ? (
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-900">Recursos & Logística</h3>
                    <p className="text-xs text-slate-500 font-medium">Itens mais solicitados nos seus eventos</p>
                  </div>
                  <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <span className="material-symbols-outlined">inventory_2</span>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safeAnalytics.byResources}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="count" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center py-20">
                <span className="material-symbols-outlined text-4xl text-slate-200 mb-4">inventory</span>
                <p className="text-slate-500 font-medium">Sem dados de logística e recursos</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex-1 overflow-x-auto custom-scrollbar-hide">
                {[
                  { id: 'all', label: 'Todos', icon: 'list' },
                  { id: 'organizer', label: 'Organizador', icon: 'assignment_ind' },
                  { id: 'coorganizer', label: 'Coorganizador', icon: 'group_work' },
                  { id: 'participant', label: 'Participante', icon: 'person' },
                  { id: 'pending', label: 'Pendentes', icon: 'hourglass_top' },
                  { id: 'rejected', label: 'Recusados', icon: 'person_off' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 justify-center flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                      activeTab === tab.id 
                        ? 'bg-white text-primary shadow-sm scale-105' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                {filteredEvents.length} Eventos
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredEvents.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm py-20 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="size-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <span className="material-symbols-outlined text-5xl">event_busy</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900">Nenhum evento por aqui</h3>
                    <p className="text-slate-500 max-w-xs mx-auto font-medium">Você não possui compromissos nesta categoria no momento.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredEvents.map((event) => {
                    const statusColor = (event.requestStatus === 'pending' || event.participationStatus === 'pending') ? 'amber' :
                                      (event.requestStatus === 'rejected' || event.participationStatus === 'rejected') ? 'red' :
                                      (event.userRole || '').toUpperCase() === 'ORGANIZADOR' ? 'blue' : 
                                      (event.userRole || '').toUpperCase() === 'COORGANIZADOR' ? 'green' : 'indigo';
                    
                    return (
                    <div 
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`group relative bg-white rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col`}
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full bg-${statusColor}-500 opacity-80`} />
                      
                      <div className="p-5 flex flex-col h-full gap-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getRoleBadge(event)}
                                {(event.nature || event.category) && (
                                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-wide transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">label</span>
                                    {event.nature || event.category}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg font-black text-slate-900 leading-snug line-clamp-2 group-hover:text-primary transition-colors mt-1">
                                {event.title}
                              </h3>
                           </div>
                           <div className="shrink-0">
                              {getStatusBadge(event)}
                           </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px w-full bg-slate-50" />

                        {/* Meta Info Grid */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                            <div className="flex items-center gap-2 text-slate-600">
                                <span className="material-symbols-outlined text-base text-slate-400">calendar_today</span>
                                <span className="font-bold">{format(getSafeDate(event.date_start), 'dd MMM yyyy', { locale: ptBR })}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-slate-600">
                                <span className="material-symbols-outlined text-base text-slate-400">schedule</span>
                                <div className="flex items-center gap-1 font-bold">
                                  <span>{format(getSafeDate(event.date_start), 'HH:mm')}</span>
                                  {event.date_end && (
                                    <>
                                      <span className="text-[9px] text-slate-300 font-black uppercase">até</span>
                                      <span>{format(getSafeDate(event.date_end), 'HH:mm')}</span>
                                    </>
                                  )}
                                </div>
                            </div>

                            <div className="col-span-2 flex items-center gap-2 text-slate-600">
                                <span className="material-symbols-outlined text-base text-slate-400">location_on</span>
                                <span className="font-bold truncate max-w-[200px]" title={event.expand?.location?.name || event.custom_location || 'Local não definido'}>
                                  {event.expand?.location?.name || event.custom_location || 'Local não definido'}
                                </span>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="mt-auto pt-2 flex justify-end">
                            <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEventInCalendar(event);
                                }}
                                className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                            >
                                <span className="material-symbols-outlined text-sm">calendar_month</span>
                                Ver no Calendário
                            </button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onCancel={handleCancelEvent}
          onDelete={handleDeleteEvent}
          user={user}
        />
      )}
    </div>
  );
};

export default MyInvolvement;
