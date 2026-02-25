import React, { useState } from 'react';
import { pb } from '../lib/pocketbase';
import { 
  AlmacRequestsResponse, 
  EventsResponse, 
  ItensServicoResponse,
  NotificationsResponse
} from '../lib/pocketbase-types';
import CustomTimePicker from './CustomTimePicker';

interface ReRequestModalProps {
  notification?: NotificationsResponse;
  request?: AlmacRequestsResponse<{ item: ItensServicoResponse }>; // Direct request object (for items)
  event?: EventsResponse;   // Direct event object (for transport)
  type?: 'item' | 'transport' | 'participation';
  onClose: () => void;
  onSuccess: () => void;
}

const ReRequestModal: React.FC<ReRequestModalProps> = ({ notification, request, event, type, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  
  // Determine mode and initial data
  let initialData: {
    quantity?: number;
    item_name?: string;
    destination?: string;
    horario_levar?: string;
    horario_buscar?: string;
    qtd_pessoas?: number;
    event_title?: string;
    kind?: string;
    event_id?: string;
    event?: string;
  } = {};
  let isItemRequest = false;
  let isTransportRequest = false;
  let isParticipationRequest = false;
  let requestId = '';
  let eventId = '';

  if (notification) {
    // Robust data parsing matching Notifications.tsx logic
    if (notification.data && Object.keys(notification.data).length > 0) {
        initialData = typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data;
    } else if (notification.meta) {
        try {
            initialData = typeof notification.meta === 'string' ? JSON.parse(notification.meta) : notification.meta;
        } catch (e) {
            initialData = {};
        }
    }

    // Robust type detection (Mutually Exclusive)
    isParticipationRequest = 
        notification.type === 'event_participation_request' || 
        initialData.kind === 'participation_request_response' ||
        type === 'participation';

    isTransportRequest = 
        !isParticipationRequest && (
            initialData.kind === 'transport_decision' || 
            notification.type === 'transport_decision' || 
            notification.type === 'transport_request' || 
            type === 'transport'
        );

    isItemRequest = 
        !isParticipationRequest && !isTransportRequest && (
            initialData.kind === 'almc_item_decision' || 
            notification.type === 'request_decision' || 
            notification.type === 'almc_item_request' || 
            type === 'item'
        );

    requestId = notification.related_request || '';
    // Tenta extrair o ID do evento de várias fontes possíveis
    eventId = notification.event || 
              (notification.expand?.event?.id) || 
              initialData.event_id || 
              initialData.event || 
              '';
  } else if (request && type === 'item') {
    isItemRequest = true;
    requestId = request.id;
    initialData = {
      quantity: request.quantity,
      item_name: request.expand?.item?.name
    };
  } else if (event && type === 'transport') {
    isTransportRequest = true;
    eventId = event.id;
    initialData = {
      destination: event.transporte_destino,
      horario_levar: event.transporte_horario_levar,
      horario_buscar: event.transporte_horario_buscar,
      qtd_pessoas: event.transporte_passageiro || event.transporte_qtd_pessoas, // Fallback for legacy
      event_title: event.title
    };
  } else if (type === 'participation' && event) {
    isParticipationRequest = true;
    eventId = event.id;
    initialData = {
      event_title: event.title
    };
  }

  const [quantity, setQuantity] = useState<number>(initialData.quantity || 1);
  const [observation, setObservation] = useState<string>('');
  const [transportData, setTransportData] = useState({
    destino: initialData.destination || '',
    horario_levar: initialData.horario_levar || '',
    horario_buscar: initialData.horario_buscar || '',
    qtd_pessoas: initialData.qtd_pessoas || 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let targetEventId = '';

    try {
      if (isParticipationRequest) {
        const rawEventId = eventId;
        targetEventId = (rawEventId && typeof rawEventId === 'object' && 'id' in (rawEventId as object)) ? (rawEventId as {id: string}).id : rawEventId as string;
        
        console.log('ReRequestModal: Início do reenvio de participação', { targetEventId, observation });

        if (!targetEventId) throw new Error('ID do evento não encontrado.');

        const user = pb.authStore.model;
        if (!user) throw new Error('Usuário não autenticado.');

        // 1. Validar permissões e restrições (igual ao EventDetailsModal)
        const eventData = await pb.collection('agenda_cap53_eventos').getOne(targetEventId);
        
        if (eventData.is_restricted) {
          alert('Este evento é restrito e não permite novas solicitações de participação.');
          setLoading(false);
          return;
        }

        if (['TRA', 'ALMC', 'DCA'].includes(user.role)) {
          alert('Seu perfil não possui permissão para solicitar participação em eventos.');
          setLoading(false);
          return;
        }

        // 2. Reiniciar a solicitação (Delete + Create para contornar restrições de UpdateRule)
        const requests = await pb.collection('agenda_cap53_solicitacoes_evento').getFullList({
            filter: `event = "${targetEventId}" && user = "${user.id}"`,
            requestKey: null
        });

        console.log('ReRequestModal: Busca de solicitações existentes', { count: requests.length });

        if (requests.length > 0) {
            // Se já existir, removemos para criar uma nova limpa
            // A permissão deleteRule permite que o próprio usuário remova sua solicitação
            await pb.collection('agenda_cap53_solicitacoes_evento').delete(requests[0].id);
            console.log('ReRequestModal: Solicitação antiga removida', { requestId: requests[0].id });
        }
        
        // Criamos uma nova solicitação com o status 'pending' e a observação no campo 'message'
        const newRequest = await pb.collection('agenda_cap53_solicitacoes_evento').create({
            event: targetEventId,
            user: user.id,
            status: 'pending',
            message: observation || ''
        });
        console.log('ReRequestModal: Nova solicitação criada com sucesso', { requestId: newRequest.id, message: observation });

        // 3. Notificar o criador do evento com histórico
        try {
            const eventCreatorId = typeof eventData.user === 'object' ? eventData.user.id : eventData.user;
            const eventTitle = eventData.title;

            if (eventCreatorId && eventCreatorId !== user.id) {
                // Recuperar histórico anterior se houver
                let history: {
                    action: string;
                    timestamp: string;
                    user: string;
                    user_name: string;
                    justification?: string;
                    message: string;
                }[] = [];
                const prevData = notification?.data || {};
                
                if (prevData.history_context?.full_history) {
                    history = [...prevData.history_context.full_history];
                }

                // Adicionar a recusa atual se não estiver no histórico
                const isDecisionInHistory = history.some(h => 
                    (h.action === 'request_rejected' || h.action === 'request_approved') && 
                    (h.timestamp === notification?.created)
                );

                if (!isDecisionInHistory && notification) {
                    history.push({
                        action: 'request_rejected',
                        timestamp: notification.created,
                        user: prevData.rejected_by || eventCreatorId,
                        user_name: prevData.rejected_by_name || 'Organizador',
                        justification: prevData.justification || notification.message,
                        message: 'Solicitação recusada'
                    });
                }

                // Adicionar a nova re-solicitação
                const now = new Date().toISOString();
                history.push({
                    action: 'request_resent',
                    timestamp: now,
                    user: user.id,
                    user_name: user.name,
                    message: observation || 'Solicitação de participação reaberta'
                });

                await pb.collection('agenda_cap53_notifications').create({
                    user: eventCreatorId,
                    title: 'Solicitação Reaberta',
                    message: `${user.name || 'Um usuário'} solicitou novamente participar do evento "${eventTitle}".${observation ? `\n\nObservação: "${observation}"` : ''}`,
                    type: 'event_participation_request',
                    event: targetEventId,
                    read: false,
                    invite_status: 'pending',
                    data: {
                        requester_id: user.id,
                        requester_name: user.name,
                        event_title: eventTitle,
                        justification: observation,
                        is_rerequest: true,
                        previous_refusal_id: notification?.id,
                        history_context: {
                            full_history: history
                        }
                    }
                });
                console.log('ReRequestModal: Notificação enviada ao criador com histórico', { eventCreatorId });
            }
        } catch (notifyError) {
            console.error('Error notifying event creator:', notifyError);
        }
      } else if (isItemRequest) {
        if (!requestId) throw new Error('ID da solicitação não encontrado.');

        // 1. Fetch current history
        const currentRequest = await pb.collection('agenda_cap53_almac_requests').getOne(requestId);
        let history: {
            timestamp: string;
            action: string;
            user: string;
            user_name: string;
            message: string;
            quantity: number;
        }[] = currentRequest.history || [];
        
        history.push({
            timestamp: new Date().toISOString(),
            action: 're_requested',
            user: pb.authStore.model?.id,
            user_name: pb.authStore.model?.name,
            message: observation,
            quantity: quantity
        });

        // 2. Update status and history
        await pb.collection('agenda_cap53_almac_requests').update(requestId, {
          status: 'pending',
          quantity: quantity,
          justification: observation || null,
          history: history
        });

        // 3. Notify Responsible Sector
        try {
            // Get item category to determine target role
            let category = request?.expand?.item?.category || 
                           notification?.expand?.related_request?.expand?.item?.category;
            
            let itemName = request?.expand?.item?.name || 
                           notification?.expand?.related_request?.expand?.item?.name || 
                           initialData.item_name || 'Item';

            let eventTitle = request?.expand?.event?.title || 
                             notification?.expand?.related_request?.expand?.event?.title || 
                             initialData.event_title || 'Evento';

            // If category is missing, fetch it
             let targetEventId = request?.event || notification?.event;
             
             if (!category || !targetEventId) {
                 const reqData = await pb.collection('agenda_cap53_almac_requests').getOne(requestId, { expand: 'item,event' });
                 category = reqData.expand?.item?.category;
                 itemName = reqData.expand?.item?.name || itemName;
                 eventTitle = reqData.expand?.event?.title || eventTitle;
                 targetEventId = reqData.event;
             }

             const targetRole = (category === 'INFORMATICA') ? 'DCA' : 'ALMC';
             
             // Find users with this role
             const targetUsers = await pb.collection('agenda_cap53_usuarios').getFullList({
                 filter: `role = "${targetRole}" || role = "ADMIN"`
             });

             // Send notifications
             await Promise.all(targetUsers.map(u => 
                 pb.collection('agenda_cap53_notifications').create({
                     user: u.id,
                     title: 'Solicitação Reaberta',
                     message: `${pb.authStore.model?.name || 'Um usuário'} solicitou novamente ${itemName} para o evento "${eventTitle}".`,
                     type: 'almc_item_request',
                     related_request: requestId,
                     event: targetEventId,
                     read: false,
                     invite_status: 'pending',
                     data: { 
                         quantity: quantity,
                         item_name: itemName,
                         event_title: eventTitle,
                         justification: observation,
                         is_rerequest: true,
                         previous_refusal_id: notification?.id
                     }
                 })
             ));

        } catch (notifyError) {
            console.error('Error notifying sector:', notifyError);
        }

      } else if (isTransportRequest) {
        if (!eventId) throw new Error('ID do evento não encontrado.');

        // 1. Update event transport details
        await pb.collection('agenda_cap53_eventos').update(eventId, {
            transporte_status: 'pending',
            transporte_destino: transportData.destino,
            transporte_horario_levar: transportData.horario_levar,
            transporte_horario_buscar: transportData.horario_buscar,
            transporte_passageiro: transportData.qtd_pessoas,
            transporte_obs: observation || ''
        });

        // 2. Notify Transport Sector (TRA)
        try {
            const traUsers = await pb.collection('agenda_cap53_usuarios').getFullList({ 
                filter: 'role = "TRA" || role = "ADMIN"' 
            });
            
            const eventData = await pb.collection('agenda_cap53_eventos').getOne(eventId);
            const eventTitle = eventData.title;

            await Promise.all(traUsers.map(u => 
                pb.collection('agenda_cap53_notifications').create({
                    user: u.id,
                    title: 'Transporte Re-solicitado',
                    message: `${pb.authStore.model?.name || 'Um usuário'} solicitou novamente transporte para o evento "${eventTitle}".`,
                    type: 'transport_request',
                    event: eventId,
                    read: false,
                    invite_status: 'pending',
                    data: { 
                        kind: 'transport_request',
                        is_rerequest: true,
                        event_title: eventTitle,
                        destino: transportData.destino,
                        horario_levar: transportData.horario_levar,
                        horario_buscar: transportData.horario_buscar,
                        qtd_pessoas: transportData.qtd_pessoas,
                        justification: observation,
                        previous_refusal_id: notification?.id
                    }
                })
            ));
        } catch (notifyError) {
            console.error('Error notifying transport sector:', notifyError);
        }
      }

      // Mark the original notification as read and updated if it exists
      if (notification) {
        const newData = {
            ...initialData,
            re_requested: true,
            re_request_date: new Date().toISOString()
        };
        await pb.collection('agenda_cap53_notifications').update(notification.id, { 
            read: true,
            data: newData,
            meta: JSON.stringify(newData)
        });
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao reenviar solicitação:', error);
      
      // Detalhes adicionais para depuração
      if (isParticipationRequest) {
          console.error('Detalhes da falha (Participação):', {
              eventId,
              targetEventId,
              userId: pb.authStore.model?.id,
              errorStack: error.stack,
              errorMessage: error.message,
              errorData: error.data
          });
      }

      alert(`Erro ao reenviar solicitação: ${error.message || 'Tente novamente.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">restart_alt</span>
            Solicitar Novamente
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm mb-4">
            <p>Você está reabrindo uma solicitação recusada.</p>
            {initialData.item_name && <p className="font-bold mt-1">Item: {initialData.item_name}</p>}
            {initialData.event_title && <p className="text-xs mt-1 opacity-80">Evento: {initialData.event_title}</p>}
          </div>

          {isTransportRequest && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Destino</label>
                <input
                  type="text"
                  value={transportData.destino}
                  onChange={e => setTransportData({...transportData, destino: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required
                  placeholder="Ex: Aeroporto, Hotel..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CustomTimePicker
                  label="Horário Ida *"
                  value={transportData.horario_levar}
                  placeholderTime={`${String((new Date().getHours() + 1) % 24).padStart(2, '0')}:00`}
                  onChange={(val) => setTransportData({...transportData, horario_levar: val})}
                />
                <CustomTimePicker
                  label="Horário Volta *"
                  value={transportData.horario_buscar}
                  placeholderTime={transportData.horario_levar ? 
                    `${String((parseInt(transportData.horario_levar.split(':')[0]) + 1) % 24).padStart(2, '0')}:00` : 
                    `${String((new Date().getHours() + 2) % 24).padStart(2, '0')}:00`
                  }
                  onChange={(val) => setTransportData({...transportData, horario_buscar: val})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Qtd. Pessoas</label>
                <input
                  type="number"
                  min="1"
                  value={transportData.qtd_pessoas}
                  onChange={e => setTransportData({...transportData, qtd_pessoas: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required
                />
              </div>
            </div>
          )}

          {isItemRequest && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Quantidade</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Observação <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              value={observation}
              onChange={e => setObservation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
              rows={3}
              placeholder="Adicione uma observação para o responsável..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              disabled={loading}
            >
              {loading ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Reenviar Solicitação
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReRequestModal;
