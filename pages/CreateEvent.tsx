import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { pb, getAvatarUrl } from '../lib/pocketbase';
import { Collections, LocaisResponse, TiposEventoResponse, ItensServicoResponse, UsersResponse, AlmacRequestsResponse } from '../lib/pocketbase-types';
import { useAuth } from '../components/AuthContext';
import { notificationService } from '../lib/notifications';
import { debugLog } from '../src/lib/debug';
import CustomSelect from '../components/CustomSelect';
import CustomDatePicker from '../components/CustomDatePicker';
import CustomTimePicker from '../components/CustomTimePicker';
import LocationField, { LocationState, normalizeBoolean } from '../components/LocationField';
import ConflictModal from '../components/ConflictModal';
import { EVENT_TYPES_ORDER, INVOLVEMENT_LEVELS, RESPONSIBILITY_LEVELS } from '../lib/constants';

const UNIDADES = [
  'CF ALICE DE JESUS REGO', 'CF DEOLINDO COUTO', 'CF EDSON ABDALLA SAAD',
  'CF ERNANI DE PAIVA FERREIRA BRAGA', 'CF HELANDE DE MELLO GONÇALVES',
  'CF ILZO MOTTA DE MELLO', 'CF JAMIL HADDAD', 'CF JOÃO BATISTA CHAGAS',
  'CF JOSÉ ANTÔNIO CIRAUDO', 'CF LENICE MARIA MONTEIRO COELHO',
  'CF LOURENÇO DE MELLO', 'CF SAMUEL PENHA VALLE', 'CF SÉRGIO AROUCA',
  'CF VALÉRIA GOMES ESTEVES', 'CF WALDEMAR BERARDINELLI', 'CMS ADELINO SIMÕES',
  'CMS ALOYSIO AMÂNCIO DA SILVA', 'CMS CATTAPRETA', 'CMS CESÁRIO DE MELO',
  'CMS CYRO DE MELLO', 'CMS DÉCIO AMARAL FILHO', 'CMS EMYDIO CABRAL',
  'CMS FLORIPES GALDINO PEREIRA', 'CMS MARIA APARECIDA DE ALMEIDA',
  'CMS SÁVIO ANTUNES', 'CAPS SIMÃO BACAMARTE', 'CAPSAD II JÚLIO CÉSAR DE CARVALHO',
  'SMS POLICLÍNICA LINCOLN DE FREITAS FILHO'
];

const CATEGORIAS_PROFISSIONAIS = [
  'ADMINISTRATIVO(A)', 'AGENTE COMUNITÁRIO DE SAÚDE (ACS)',
  'AGENTE DE VIGILÂNCIA SANITÁRIA (AVS)', 'ASSISTENTE SOCIAL',
  'AUXILIAR DE SAÚDE BUCAL', 'AUXILIAR DE SERVIÇOS GERAIS',
  'CONTROLADOR DE ACESSO', 'DENTISTA', 'DIRETOR',
  'ENFERMEIRO(A)', 'FARMACÊUTICO(A)', 'FISIOTERAPEUTA',
  'FONOAUDIÓLOGO(A)', 'GERENTE', 'MÉDICO(A)', 'NUTRICIONISTA',
  'PROFESSOR(A) ED. FÍSICA', 'PSICÓLOGO(A)',
  'RT DE ENFERMAGEM (UNIDADE)', 'RT MÉDICO (UNIDADE)',
  'TÉCNICO(A) DE ENFERMAGEM', 'TÉCNICO(A) DE FARMÁCIA',
  'TÉCNICO(A) DE SAÚDE BUCAL', 'TERAPEUTA OCUPACIONAL'
];

const CreateEvent: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
        const restrictedRoles = ['DCA', 'ALMC', 'TRA'];
        if (restrictedRoles.includes(user.role)) {
            alert('Você não tem permissão para criar eventos.');
            navigate('/calendar', { replace: true });
        }
    }
  }, [user, navigate]);

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      // Não mover foco se estiver em um textarea ou se for o botão de submit
      if (
        target.tagName === 'INPUT' && 
        (target as HTMLInputElement).type !== 'submit' &&
        (target as HTMLInputElement).type !== 'checkbox' &&
        (target as HTMLInputElement).type !== 'radio'
      ) {
        e.preventDefault();
        const form = (target as HTMLInputElement).form;
        if (form) {
          const elements = Array.from(form.elements).filter(el => {
            const htmlEl = el as HTMLElement;
            return !htmlEl.hasAttribute('disabled') && 
                   htmlEl.tagName !== 'FIELDSET' && 
                   (htmlEl as any).type !== 'hidden' &&
                   htmlEl.offsetParent !== null; // Verifica se o elemento é visível
          });
          
          const index = elements.indexOf(target as any);
          if (index > -1 && elements[index + 1]) {
            (elements[index + 1] as HTMLElement).focus();
          }
        }
      }
    }
  };
  const [locations, setLocations] = useState<LocaisResponse[]>([]);
  const [eventTypes, setEventTypes] = useState<TiposEventoResponse[]>([]);
  const [availableItems, setAvailableItems] = useState<ItensServicoResponse[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UsersResponse[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState(''); // To track title changes
  const [type, setType] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [involvementLevel, setInvolvementLevel] = useState('');
  const [locationState, setLocationState] = useState<LocationState>({ mode: 'fixed', fixedId: '', freeText: '' });
  const [observacoes, setObservacoes] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [originalParticipants, setOriginalParticipants] = useState<string[]>([]); // To track changes for notifications
  const [almoxarifadoItems, setAlmoxarifadoItems] = useState<string[]>([]);
  const [copaItems, setCopaItems] = useState<string[]>([]);
  const [informaticaItems, setInformaticaItems] = useState<string[]>([]);
  const [transporteSuporte, setTransporteSuporte] = useState(false);
  const [transporteOrigem, setTransporteOrigem] = useState('');
  const [transporteDestino, setTransporteDestino] = useState('');
  const [transporteHorarioLevar, setTransporteHorarioLevar] = useState('');
  const [transporteHorarioBuscar, setTransporteHorarioBuscar] = useState('');
  const [transportePassageiros, setTransportePassageiros] = useState('');
  const [transporteObs, setTransporteObs] = useState('');
  const [originalTransporteSuporte, setOriginalTransporteSuporte] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [estimatedParticipants, setEstimatedParticipants] = useState<string>('');
  const [selectedUnidades, setSelectedUnidades] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [envolverProfissionais, setEnvolverProfissionais] = useState(false);
  const [logisticaRecursos, setLogisticaRecursos] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipants, setShowParticipants] = useState(true);
  const [activeTab, setActiveTab] = useState<'almoxarifado' | 'copa' | 'informatica' | 'transporte'>('almoxarifado');
  const [unitSearch, setUnitSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [isDateInvalid, setIsDateInvalid] = useState(false);
  const [isDurationInvalid, setIsDurationInvalid] = useState(false);

  const orderedEventTypeOptions = useMemo(() => {
    const eventTypesByName = new Map(
      eventTypes.map(type => [String(type.name || '').trim().toLowerCase(), type])
    );
    const ordered = EVENT_TYPES_ORDER
      .map(label => {
        const normalized = label.trim().toLowerCase();
        const type = eventTypesByName.get(normalized);
        return type ? { value: type.name, label } : null;
      })
      .filter((item): item is { value: string; label: string } => Boolean(item));
    return ordered.length > 0 ? ordered : eventTypes.map(t => ({ value: t.name, label: t.name }));
  }, [eventTypes]);
  const [isTransportTimeInvalid, setIsTransportTimeInvalid] = useState(false);
  const [isConflictCheckLoading, setIsConflictCheckLoading] = useState(false);
  // Quantity State
  const [itemQuantities, setItemQuantities] = useState<{ [itemId: string]: number }>({});
  const [confirmedItems, setConfirmedItems] = useState<string[]>([]);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const [visibleParticipantsCount, setVisibleParticipantsCount] = useState(5);

  // Reset pagination when search changes
  useEffect(() => {
    setVisibleParticipantsCount(5);
  }, [participantSearch]);

  const [searchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);

  // Sync with global search
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setParticipantSearch(params.get('search') || '');
  }, [location.search]);

  // Memoized user list filtering and sorting
  const sortedFilteredUsers = useMemo(() => {
    const s = participantSearch.toLowerCase();
    const restrictedRoles = ['ALMC', 'TRA', 'DCA'];
    const crId = creatorId || user?.id;

    return availableUsers
      .filter(u => {
        const searchMatch = !s || 
          (u.name || '').toLowerCase().includes(s) || 
          (u.email || '').toLowerCase().includes(s) || 
          (u.role || '').toLowerCase().includes(s) || 
          (u.sector || '').toLowerCase().includes(s);
        
        if (!searchMatch) return false;

        const userRole = (u.role || '').toUpperCase();
        if (restrictedRoles.includes(userRole)) return false;

        return true;
      })
      .sort((a, b) => {
        if (!a || !b) return 0;
        if (a.id === crId) return -1;
        if (b.id === crId) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [availableUsers, participantSearch, creatorId, user?.id]);

  // Validate dates
  useEffect(() => {
    if (dateStart && dateEnd) {
      const start = new Date(dateStart);
      const end = new Date(dateEnd);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        setIsDateInvalid(start > end);
        
        // Check if duration > 23h 59m (24 hours or more)
        const durationMs = end.getTime() - start.getTime();
        const maxDurationMs = 24 * 60 * 60 * 1000 - 1000; // 23h 59m 59s
        setIsDurationInvalid(durationMs > maxDurationMs);
      } else {
        setIsDateInvalid(false);
        setIsDurationInvalid(false);
      }
    } else {
      setIsDateInvalid(false);
      setIsDurationInvalid(false);
    }
  }, [dateStart, dateEnd]);

  // Validate transport times
  useEffect(() => {
    if (transporteSuporte && transporteHorarioLevar && transporteHorarioBuscar) {
      setIsTransportTimeInvalid(transporteHorarioLevar >= transporteHorarioBuscar);
    } else {
      setIsTransportTimeInvalid(false);
    }
  }, [transporteSuporte, transporteHorarioLevar, transporteHorarioBuscar]);

  // Conflict Modal State
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictModalData, setConflictModalData] = useState<{
    title: string;
    message: string;
    details: string;
    type: 'warning' | 'danger';
  }>({
    title: '',
    message: '',
    details: '',
    type: 'warning'
  });

  const saveEvent = async () => {
    if (!dateStart || !dateEnd) {
      alert('Por favor, selecione as datas de início e fim.');
      return;
    }

    if (isDateInvalid) {
      alert('A data de início não pode ser posterior à data de término.');
      return;
    }

    if (isDurationInvalid) {
      alert('A duração do evento não pode exceder 23 horas e 59 minutos.');
      return;
    }

    if (!involvementLevel) {
      alert('Por favor, selecione o nível de envolvimento.');
      return;
    }

    setLoading(true);
    try {
          const startISO = dateStart.includes('Z') ? dateStart : new Date(dateStart).toISOString();
      const endISO = dateEnd.includes('Z') ? dateEnd : new Date(dateEnd).toISOString();

      // Initialize participants_status and participants_roles
      const participantsStatus: Record<string, string> = {};
      const participantsRoles: Record<string, string> = { ...participantRoles };
      
      // Ensure the creator/user is included in selectedParticipants if they are the one creating
      // but in this app, creator is separate from participants list usually.
      // However, if the user chose an involvementLevel, we should respect that for the creator's role record.
      const creatorRoleToUse = involvementLevel || 'PARTICIPANTE';

      selectedParticipants.forEach(pId => {
          if (!participantsRoles[pId]) {
            participantsRoles[pId] = 'PARTICIPANTE';
          }
          participantsStatus[pId] = 'pending';
      });

      let existingTransporteStatus: string | null = null;

      // Merge with existing status if editing
      if (isEditing && editingEventId) {
          try {
              const existingEvent = await pb.collection(Collections.AgendaCap53Eventos).getOne(editingEventId);
              existingTransporteStatus = existingEvent.transporte_status || null;
              if (existingEvent.participants_status) {
                  Object.assign(participantsStatus, existingEvent.participants_status);
                  Object.keys(participantsStatus).forEach(key => {
                      if (!selectedParticipants.includes(key)) {
                          delete participantsStatus[key];
                      }
                  });
              }
              if (existingEvent.participants_roles) {
                  Object.assign(participantsRoles, existingEvent.participants_roles);
                  Object.keys(participantsRoles).forEach(key => {
                      if (!selectedParticipants.includes(key)) {
                          delete participantsRoles[key];
                      }
                  });
              }
          } catch(e) {
              console.error("Erro ao carregar status e níveis dos participantes:", e);
          }
      }

      // Logic to initialize transport_history for new transport requests
      let initialTransportHistory = undefined;
      // If it's a new event with transport, or an existing event adding transport for the first time
      if (transporteSuporte && (!isEditing || (isEditing && !existingTransporteStatus))) {
           initialTransportHistory = [{
               timestamp: new Date().toISOString(),
               action: 'created',
               user: user?.id,
               user_name: user?.name,
               message: 'Solicitação de transporte criada'
           }];
      }

      const eventData = {
        title, 
        nature: type, // Sincronizando com o campo Natureza usado nos relatórios
        type, 
        description: observacoes,
        observacoes,
        location: locationState.mode === 'fixed' && locationState.fixedId ? locationState.fixedId : null, 
        custom_location: locationState.mode === 'free' ? locationState.freeText : null,
        date_start: startISO, date_end: endISO,
        participants: selectedParticipants, user: user?.id, status: 'active',
        almoxarifado_items: almoxarifadoItems, 
        copa_items: copaItems,
        informatica_items: informaticaItems,
        transporte_suporte: transporteSuporte,
        transporte_origem: transporteSuporte ? (transporteOrigem || null) : null,
        transporte_destino: transporteSuporte ? (transporteDestino || null) : null,
        transporte_passageiro: transporteSuporte ? (transportePassageiros ? String(transportePassageiros) : null) : null,
        transporte_horario_levar: transporteSuporte ? (transporteHorarioLevar || null) : null,
        transporte_horario_buscar: transporteSuporte ? (transporteHorarioBuscar || null) : null,
        transporte_obs: transporteSuporte ? (transporteObs || null) : null,
        unidades: selectedUnidades,
        categorias_profissionais: selectedCategorias,
        is_restricted: isRestricted,
        estimated_participants: responsibility === 'EXTERNO_COMPROMISSO' ? null : (estimatedParticipants ? parseInt(estimatedParticipants) : null),
        transporte_status: transporteSuporte ? (existingTransporteStatus || 'pending') : null,
        participants_status: participantsStatus,
        participants_roles: participantsRoles,
        creator_role: involvementLevel || 'PARTICIPANTE',
        event_responsibility: responsibility,
        transport_history: initialTransportHistory
      };

      let eventId = editingEventId;

      if (isEditing && editingEventId) {
         console.log('--- UPDATING EVENT ---', editingEventId, eventData);
         await pb.collection(Collections.AgendaCap53Eventos).update(editingEventId, eventData);

         // Sincronizar atualizações de título em notificações de convite de evento
         // As notificações de itens/transporte são tratadas especificamente abaixo
         if (title !== originalTitle) {
           try {
             const pendingNotifications = await pb.collection(Collections.AgendaCap53Notifications).getFullList({
               filter: `event = "${editingEventId}" && type = "event_invite" && invite_status = "pending"`
             });

             await Promise.all(pendingNotifications.map(notif => {
               let newMessage = notif.message;
               if (originalTitle && newMessage.includes(`"${originalTitle}"`)) {
                 newMessage = newMessage.split(`"${originalTitle}"`).join(`"${title}"`);
               }
               
               return pb.collection('agenda_cap53_notifications').update(notif.id, {
                 message: newMessage
               });
             }));
           } catch (err) {
             console.error('Erro ao atualizar título nas notificações:', err);
           }
         }

         const newParticipants = selectedParticipants.filter(pId => !originalParticipants.includes(pId));
         if (newParticipants.length > 0) {
            try {
                // Create participante records for new participants
                await Promise.all(newParticipants.map(pId => 
                  pb.collection(Collections.AgendaCap53Participantes).create({
                    event: editingEventId,
                    user: pId,
                    status: 'pending',
                    role: participantsRoles[pId] || 'PARTICIPANTE'
                  })
                ));

                // Notificar organizador sobre novos convites na edição
                const newParticipantNames = newParticipants
                  .map(pId => availableUsers.find(u => u.id === pId)?.name)
                  .filter(Boolean)
                  .join(', ');

                const estimatedText = estimatedParticipants ? `\n\nQuantidade estimada de presentes: ${estimatedParticipants} pessoas.` : '';
                await notificationService.bulkCreateNotifications(
                    newParticipants,
                    {
                        title: 'Novo Convite de Evento',
                        message: `Você foi convidado para o evento "${title}".${estimatedText}`,
                        type: 'event_invite',
                        event: editingEventId || undefined,
                        data: {
                            estimated_participants: estimatedParticipants ? parseInt(estimatedParticipants) : undefined
                        }
                    }
                );

                await notificationService.createNotification({
                    user: user?.id || '',
                    title: 'Novos Convites Enviados',
                    message: `Convite para evento "${title}" enviado para: ${newParticipantNames}.${estimatedText}`,
                    type: 'system',
                    event: editingEventId || undefined,
                    data: {
                        kind: 'organizer_invite_sent',
                        participants_count: newParticipants.length,
                        participants_names: newParticipantNames
                    }
                });
            } catch (notifErr) {
                console.error("Falha ao criar registros/notificações para novos participantes:", notifErr);
            }
         }
      } else {
         console.log('--- CREATING NEW EVENT ---', eventData);
         const created = await pb.collection(Collections.AgendaCap53Eventos).create(eventData);
         eventId = created.id;
         if (selectedParticipants.length > 0) {
          // Create participante records
          await Promise.all(selectedParticipants.map(participantId => 
            pb.collection(Collections.AgendaCap53Participantes).create({
              event: eventId,
              user: participantId,
              status: 'pending',
              role: participantsRoles[participantId] || involvementLevel || 'PARTICIPANTE'
            })
          ));

          // Send notifications using service
          const estimatedText = (responsibility !== 'EXTERNO_COMPROMISSO' && estimatedParticipants) ? `\n\nQuantidade estimada de presentes: ${estimatedParticipants} pessoas.` : '';
          await notificationService.bulkCreateNotifications(
            selectedParticipants.filter(pId => pId !== user?.id),
            {
              title: 'Novo Convite de Evento',
              message: `Você foi convidado para o evento "${title}".${estimatedText}`,
              type: 'event_invite',
              event: eventId || undefined,
              data: {
                estimated_participants: estimatedParticipants ? parseInt(estimatedParticipants) : undefined
              }
            }
          );

          // Criar notificação para o organizador sobre o envio dos convites
          const participantNames = selectedParticipants
            .map(pId => availableUsers.find(u => u.id === pId)?.name)
            .filter(Boolean)
            .join(', ');

          await notificationService.createNotification({
            user: user?.id || '',
            title: 'Convites Enviados',
            message: `Convite para evento "${title}" enviado para: ${participantNames}.`,
            type: 'system',
            event: eventId || undefined,
            data: {
              kind: 'organizer_invite_sent',
              participants_count: selectedParticipants.length,
              participants_names: participantNames
            }
          });
         }
      }

      if (eventId) {
          try {
            const selectedItemIds = confirmedItems;
            console.log('--- SYNC LOGÍSTICA START ---', { eventId, selectedItemIds, itemQuantities });
            
            const existingRequests = await pb.collection(Collections.AgendaCap53AlmacRequests).getFullList({
              filter: `event = "${eventId}"`,
            });
            console.log('--- EXISTING REQUESTS ---', existingRequests.length);

            const existingByItem = new Map<string, any>();
            existingRequests.forEach((r: any) => {
              if (r.item) existingByItem.set(r.item, r);
            });

            // 1. Remover itens que não estão mais na lista confirmada
            const removedRequests = existingRequests.filter((r: any) => r.item && !selectedItemIds.includes(r.item));
            if (removedRequests.length > 0) {
              console.log('--- REMOVING REQUESTS ---', removedRequests.length);
              await Promise.all(removedRequests.map(async (r: any) => {
                try {
                  const pendingNotifs = await pb.collection(Collections.AgendaCap53Notifications).getFullList({
                    filter: `related_request = "${r.id}" && invite_status = "pending"`
                  });
                  await Promise.all(pendingNotifs.map(n => pb.collection(Collections.AgendaCap53Notifications).delete(n.id)));
                } catch (err) {
                  console.error('Erro ao remover notificações de pedido excluído:', err);
                }
                return pb.collection(Collections.AgendaCap53AlmacRequests).delete(r.id);
              }));
            }

            // 2. Criar ou Atualizar itens
            const createdRequests: any[] = [];
            for (const itemId of selectedItemIds) {
              const existing = existingByItem.get(itemId);
              const quantity = itemQuantities[itemId] || 1;
              const currentItem = availableItems.find(i => i.id === itemId);

              if (!existing) {
                console.log('--- CREATING NEW REQUEST ---', itemId, quantity);
                const isAvailable = currentItem ? (currentItem.is_available !== false) : true;
                const createdReq = await pb.collection('agenda_cap53_almac_requests').create({
                  event: eventId,
                  item: itemId,
                  status: 'pending',
                  created_by: user?.id,
                  quantity: Number(quantity), // Garantir que é número
                  item_snapshot_available: isAvailable,
                  history: [{
                    timestamp: new Date().toISOString(),
                    action: 'created',
                    user: user?.id,
                    user_name: user?.name,
                    message: `Solicitação criada com quantidade: ${quantity}`
                  }]
                });
                createdRequests.push(createdReq);
              } else {
                // Se o pedido já existe, atualizamos a quantidade e sincronizamos notificações
                const oldQuantity = Number(existing.quantity) || 1;
                const newQuantity = Number(quantity);
                
                const quantityChanged = oldQuantity !== newQuantity;
                const titleChanged = title !== originalTitle;

                console.log(`--- CHECKING UPDATE FOR ${itemId} ---`, { oldQuantity, newQuantity, quantityChanged, titleChanged });

                const updateData: any = {};
                if (quantityChanged) updateData.quantity = newQuantity;
                
                if (currentItem) {
                  const isAvailable = currentItem.is_available !== false;
                  if (existing.item_snapshot_available !== isAvailable) {
                    updateData.item_snapshot_available = isAvailable;
                  }
                }

                if (Object.keys(updateData).length > 0 || titleChanged) {
                  // 1. Atualiza o pedido
                  if (Object.keys(updateData).length > 0) {
                    console.log('--- UPDATING REQUEST ---', existing.id, updateData);
                    await pb.collection(Collections.AgendaCap53AlmacRequests).update(existing.id, updateData);
                  }
                  
                  // 2. A sincronização de notificações (quantidade/título) é feita automaticamente
                  // pelo Hook do PocketBase (onRecordAfterUpdateRequest) para garantir consistência.
                  console.log('--- SYNC DELEGADO PARA O BACKEND HOOK ---');
                }
              }
            }

            if (createdRequests.length > 0) {
              console.log('--- CREATING NOTIFICATIONS FOR NEW REQUESTS ---', createdRequests.length);
              // Buscar usuários ALMC e DCA
              const sectorUsers = await pb.collection(Collections.AgendaCap53Usuarios).getFullList({ 
                filter: 'role = "ALMC" || role = "DCA"' 
              });
              
              const itemNameById = new Map<string, string>();
              availableItems.forEach((it: any) => itemNameById.set(it.id, it.name));
              
              const itemCategoryById = new Map<string, string>();
              availableItems.forEach((it: any) => itemCategoryById.set(it.id, it.category));

              await Promise.all(
                createdRequests.flatMap((req: any) => {
                  const itemCategory = itemCategoryById.get(req.item);
                  // Se for INFORMATICA, notifica DCA. Caso contrário (ALMOXARIFADO/COPA), notifica ALMC.
                  const targetRole = itemCategory === 'INFORMATICA' ? 'DCA' : 'ALMC';
                  
                  const targetUserIds = sectorUsers
                    .filter((u: any) => u.role === targetRole && u.id !== user?.id)
                    .map((u: any) => u.id);

                  console.log(`--- NOTIFYING ${targetUserIds.length} USERS FOR ITEM ${req.item} (ROLE: ${targetRole}) ---`);

                  if (targetUserIds.length === 0) {
                    console.log('❌ Nenhum usuário encontrado para notificar');
                    return [];
                  }

                  console.log('🎯 Usuários a serem notificados:', targetUserIds);

                  const estimatedText = (responsibility !== 'EXTERNO_COMPROMISSO' && estimatedParticipants) ? `\n\nQuantidade estimada de presentes: ${estimatedParticipants} pessoas.` : '';

                  return notificationService.bulkCreateNotifications(
                    targetUserIds,
                    {
                      title: 'Solicitação de Item',
                      message: `O evento "${title}" solicitou o item "${itemNameById.get(req.item) || 'Item'}" (Qtd: ${req.quantity || 1}).${estimatedText}`,
                      type: 'almc_item_request',
                      related_request: req.id,
                      event: eventId || undefined,
                      data: { kind: 'almc_item_request', quantity: req.quantity || 1, item: req.item, estimated_participants: responsibility !== 'EXTERNO_COMPROMISSO' && estimatedParticipants ? parseInt(estimatedParticipants) : undefined }
                    }
                  ).then(results => {
                    console.log('✅ bulkCreateNotifications concluído:', results.length, 'notificações criadas');
                    return results;
                  }).catch(error => {
                    console.error('❌ ERRO em bulkCreateNotifications:', error);
                    throw error;
                  });
                })
              );
            }

            if (transporteSuporte && (!isEditing || !originalTransporteSuporte)) {
              try {
                const traUsers = await pb.collection(Collections.AgendaCap53Usuarios).getFullList({ 
                  filter: 'role = "TRA"' 
                });
                
                // Lista de destinatários para o setor de transporte (TRA)
                const traIds = traUsers
                  .filter((traUser: any) => traUser.id !== user?.id && !selectedParticipants.includes(traUser.id))
                  .map((traUser: any) => traUser.id);

                // 1. Notifica o Setor de Transporte (TRA)
                if (traIds.length > 0) {
                  const estimatedText = estimatedParticipants ? `\n\nQuantidade estimada de presentes: ${estimatedParticipants} pessoas.` : '';
                  await notificationService.bulkCreateNotifications(
                    traIds,
                    {
                      title: 'Solicitação de Transporte',
                      message: `O evento "${title}" solicitou suporte de transporte.${estimatedText}`,
                      type: 'transport_request',
                      event: eventId || undefined,
                      data: { 
                        kind: 'transport_request',
                        origem: transporteOrigem,
                        destino: transporteDestino,
                        horario_levar: transporteHorarioLevar,
                        horario_buscar: transporteHorarioBuscar,
                        estimated_participants: responsibility !== 'EXTERNO_COMPROMISSO' && estimatedParticipants ? parseInt(estimatedParticipants) : undefined
                      }
                    }
                  );
                }

                // 2. Notifica o próprio criador (para histórico na Timeline)
                if (user?.id) {
                    await pb.collection(Collections.AgendaCap53Notifications).create({
                        user: user.id,
                        title: 'Solicitação de Transporte',
                        message: `Você solicitou suporte de transporte para o evento "${title}".`,
                        type: 'transport_request',
                        event: eventId || undefined,
                        read: true, // Já lida para o criador
                        data: { 
                            kind: 'transport_request',
                            origem: transporteOrigem,
                            destino: transporteDestino,
                            horario_levar: transporteHorarioLevar,
                            horario_buscar: transporteHorarioBuscar,
                            is_creator_copy: true
                        }
                    });
                }
              } catch (err) {
                console.error('Error creating TRA notifications:', err);
              }
            } else if (transporteSuporte && isEditing && originalTransporteSuporte) {
              // Sync de transporte também delegado ao Backend Hook
              console.log('--- SYNC DE TRANSPORTE DELEGADO PARA O BACKEND HOOK ---');
            } else if (!transporteSuporte && isEditing && originalTransporteSuporte) {
              // Se o suporte de transporte foi removido, cancela notificações pendentes
              try {
                const pendingTraNotifs = await pb.collection('agenda_cap53_notifications').getFullList({
                  filter: `event = "${editingEventId}" && type = "transport_request" && invite_status = "pending"`
                });
                await Promise.all(pendingTraNotifs.map(n => pb.collection(Collections.AgendaCap53Notifications).delete(n.id)));
              } catch (err) {
                console.error('Erro ao remover notificações de transporte cancelado:', err);
              }
            }
          } catch (reqErr: any) {
            console.error('Falha ao criar/atualizar solicitações de logística:', reqErr);
            alert(`Evento salvo, mas houve erro ao atualizar itens: ${reqErr.message || 'Erro desconhecido'}`);
          }
      }

      // Função auxiliar para sincronizar notificações no cliente (Fallback para servidor remoto)
      const clientSideSync = async (evtId: string) => {
          try {
              console.log('--- INICIANDO SYNC CLIENT-SIDE (FALLBACK) ---');
              const notifs = await pb.collection(Collections.AgendaCap53Notifications).getFullList({
                  filter: `event = "${evtId}" && (type = "almc_item_request" || type = "service_request")`
              });
              
              const reqs = await pb.collection(Collections.AgendaCap53AlmacRequests).getFullList<AlmacRequestsResponse<{ item: ItensServicoResponse }>>({
                filter: `event = "${evtId}"`,
                expand: 'item'
            });
              
              console.log(`Encontradas ${notifs.length} notificações e ${reqs.length} pedidos.`);
              
              // Mapeia pedidos
              const reqMap = new Map();
              reqs.forEach((r: any) => reqMap.set(r.id, r));
              
              const updates = [];
              const processedReqIds = new Set();
              
              for (const notif of notifs) {
                  let shouldUpdate = false;
                  let data: any = notif.data;
                  
                  // Normaliza data
                  if (typeof data === 'string') {
                      try { data = JSON.parse(data); } catch(e) {}
                  }
                  data = data || {};
                  
                  // Tenta achar o pedido correspondente
                  let req = null;
                  if (notif.related_request && reqMap.has(notif.related_request)) {
                      req = reqMap.get(notif.related_request);
                  } else if (data.item) {
                      // Fallback por item
                      req = reqs.find((r: any) => r.item === data.item);
                  }
                  
                  if (req) {
                      processedReqIds.add(req.id);
                      const correctQty = req.quantity;
                      
                      // Verifica se precisa atualizar data
                      if (data.quantity !== correctQty) {
                          data.quantity = correctQty;
                          shouldUpdate = true;
                      }
                      
                      // Verifica se precisa atualizar mensagem
                      let msg = notif.message || '';
                      if (msg.includes('(Qtd:')) {
                          // Substitui padrão existente
                          const newMsg = msg.replace(/\(Qtd: \d+\)/, `(Qtd: ${correctQty})`);
                          if (newMsg !== msg) {
                              msg = newMsg;
                              shouldUpdate = true;
                          }
                      } else {
                          const itemName = req.expand?.item?.name || 'Item';
                          if (!msg.includes(`(Qtd: ${correctQty})`) || !msg.includes(itemName)) {
                              msg = `O evento "${title}" solicitou o item "${itemName}" (Qtd: ${correctQty}).`;
                              shouldUpdate = true;
                          }
                      }
                      
                      if (shouldUpdate) {
                          console.log(`Atualizando notificação ${notif.id} para Qtd: ${correctQty}`);
                          updates.push(
                              pb.collection(Collections.AgendaCap53Notifications).update(notif.id, {
                                  message: msg,
                                  data: data,
                                  related_request: req.id // Garante vínculo
                              }).catch(err => console.warn(`Falha ao atualizar notificação ${notif.id}:`, err))
                          );
                      }
                  }
              }

              // CRIA NOTIFICAÇÕES FALTANTES NO CLIENTE (SE O BACKEND FALHAR)
              for (const req of reqs) {
                  if (!processedReqIds.has(req.id)) {
                      debugLog('CreateEvent', `Criando notificações faltantes para pedido ${req.id} no cliente...`);
                      const item = req.expand?.item;
                      if (!item) continue;
                      
                      const targetRole = item.category === 'INFORMATICA' ? 'DCA' : 'ALMC';
                      debugLog('CreateEvent', `Target role para item ${item.name}: ${targetRole}`);
                      
                      try {
                          const sectorUsers = await pb.collection(Collections.AgendaCap53Usuarios).getFullList({
                              filter: `role = "${targetRole}"`
                          });
                          
                          debugLog('CreateEvent', `Usuários encontrados para ${targetRole}:`, sectorUsers.length);
                          
                          for (const u of sectorUsers) {
                              // Removido o skip do próprio criador para garantir que ele veja a notificação na lista
                              // se ele for do setor responsável (ALMC/DCA)
                              
                              debugLog('CreateEvent', `Criando notificação para usuário ${u.id} (${u.name || u.email})`);
                              
                              updates.push(
                                  pb.collection('agenda_cap53_notifications').create({
                                      user: u.id,
                                      title: 'Solicitação de Item',
                                      message: `O evento "${title}" solicitou o item "${item.name}" (Qtd: ${req.quantity}).`,
                                      type: 'almc_item_request',
                                      read: false,
                                      event: evtId,
                                      related_request: req.id,
                                      invite_status: 'pending',
                                      acknowledged: false,
                                      data: { 
                                          kind: 'almc_item_request', 
                                          quantity: req.quantity, 
                                          item: item.id,
                                          event_title: title
                                      }
                                  }).catch(err => console.warn(`Falha ao criar notificação para ${u.id}:`, err))
                              );
                          }
                      } catch (err) {
                          console.error(`Erro ao buscar usuários ${targetRole} para sync cliente:`, err);
                      }
                  }
              }
              
              await Promise.all(updates);
              console.log('--- SYNC CLIENT-SIDE CONCLUÍDO ---');
          } catch (err) {
              console.error('Erro no sync client-side:', err);
          }
      };

      if (isEditing) {
        // Tenta endpoint do servidor primeiro, se falhar (404), usa fallback cliente
        try {
           console.log('--- TENTANDO SYNC VIA SERVIDOR ---');
           const syncRes = await pb.send('/api/sync_event_notifications', {
              method: 'POST',
              body: { event_id: eventId }
           });
           console.log('--- SYNC VIA SERVIDOR SUCESSO ---', syncRes);
        } catch(syncErr: any) {
           console.warn('Sync via servidor falhou (endpoint não existe ou erro), usando fallback local.', syncErr.status);
           if (syncErr.status === 404 || syncErr.status === 0) {
               await clientSideSync(eventId);
           }
        }
      }

      await pb.collection(Collections.AgendaAuditLogs).create({
        user: user?.id,
        action: isEditing ? 'UPDATE_EVENT' : 'CREATE_EVENT',
        target_type: 'agenda_cap53_eventos',
        target_id: eventId,
        details: { title, type, location: locationState.fixedId }
      });

      alert(isEditing ? 'Evento atualizado!' : 'Evento criado!');
      navigate('/calendar');
    } catch (err: any) {
      console.error('Erro na submissão:', err);
      alert(`Erro ao salvar: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Removido bloqueio de ALMC e TRA para permitir exibição da página conforme solicitado
  /*
  useEffect(() => {
    if (user && (user.role === 'ALMC' || user.role === 'TRA')) {
      alert('Aviso: Usuários ALMC e TRA não podem criar eventos.');
      navigate('/calendar');
    }
  }, [user, navigate]);
  */

  useEffect(() => {
    const dateParam = searchParams.get('date');
    const eventIdParam = searchParams.get('eventId') || searchParams.get('edit') || searchParams.get('edit_from');
    const duplicateIdParam = searchParams.get('duplicate_from');
    const participantsParam = searchParams.get('participants');

    if (participantsParam) {
      try {
        const decodedParticipants = JSON.parse(decodeURIComponent(participantsParam));
        if (Array.isArray(decodedParticipants)) {
          setSelectedParticipants(decodedParticipants);
        }
      } catch (e) {
        console.error("Erro ao processar participantes da URL", e);
      }
    }

    if (duplicateIdParam) {
      console.log('--- MODO DUPLICAÇÃO DETECTADO ---', { duplicateIdParam });
      setLoading(true);

      const loadDuplicateEvent = async () => {
        try {
          console.log('--- BUSCANDO DADOS PARA DUPLICAÇÃO ---', duplicateIdParam);
          const event = await pb.collection(Collections.AgendaCap53Eventos).getOne(duplicateIdParam);
          
          // Copiar apenas Dados Essenciais
          setTitle(event.title || '');
          setType(event.type || '');
          setResponsibility(event.event_responsibility || '');
          setInvolvementLevel(event.creator_role || 'PARTICIPANTE');
          setObservacoes(event.observacoes || event.description || '');
          
          // Copiar Localização
          if (event.location === 'external' || (!event.location && event.custom_location)) {
            setLocationState({ mode: 'free', fixedId: 'external', freeText: event.custom_location || '' });
          } else {
            setLocationState({ mode: 'fixed', fixedId: event.location || '', freeText: '' });
          }
          
          // Copiar Restrição
          setIsRestricted(!!event.is_restricted);
          
          // Copiar Quantidade de Participantes
          setEstimatedParticipants(event.estimated_participants ? String(event.estimated_participants) : '');

          // Copiar Envolvimento de Unidades e Profissionais
          setSelectedUnidades(event.unidades || []);
          setSelectedCategorias(event.categorias_profissionais || []);
          setEnvolverProfissionais(((event.unidades?.length || 0) > 0 || (event.categorias_profissionais?.length || 0) > 0));

          // Copiar Logística e Transporte
          setTransporteSuporte(!!event.transporte_suporte);
          setTransporteOrigem(event.transporte_origem || '');
          setTransporteDestino(event.transporte_destino || '');
          setTransporteHorarioLevar(event.transporte_horario_levar || '');
          setTransporteHorarioBuscar(event.transporte_horario_buscar || '');
          setTransportePassageiros(event.transporte_passageiro ? String(event.transporte_passageiro) : '');
          setTransporteObs(event.transporte_obs || '');

          // Fetch items for Logística & Recursos
          try {
            const requests = await pb.collection(Collections.AgendaCap53AlmacRequests).getFullList({
               filter: `event = "${duplicateIdParam}"`,
               expand: 'item'
            });
            
            const newAlmoxarifadoItems: string[] = [];
            const newCopaItems: string[] = [];
            const newInformaticaItems: string[] = [];
            const newQuantities: {[key: string]: number} = {};
            
            requests.forEach((req: any) => {
               const item = req.expand?.item;
               if (item) {
                  if (item.category === 'ALMOXARIFADO') {
                     newAlmoxarifadoItems.push(item.id);
                  } else if (item.category === 'COPA') {
                     newCopaItems.push(item.id);
                  } else if (item.category === 'INFORMATICA') {
                     newInformaticaItems.push(item.id);
                  }
                  newQuantities[item.id] = req.quantity || 1;
               }
            });
            
            setAlmoxarifadoItems(newAlmoxarifadoItems);
            setCopaItems(newCopaItems);
            setInformaticaItems(newInformaticaItems);
            setItemQuantities(newQuantities);
            setConfirmedItems([...newAlmoxarifadoItems, ...newCopaItems, ...newInformaticaItems]);
            setLogisticaRecursos(newAlmoxarifadoItems.length > 0 || newCopaItems.length > 0 || newInformaticaItems.length > 0 || !!event.transporte_suporte);
          } catch (err) {
            console.error("Erro ao buscar solicitações de logística para duplicação", err);
          }

          // Configurar Datas Padrão (Hoje + 1h)
          const now = new Date();
          const startHour = now.getHours() + 1;
          const start = new Date();
          start.setHours(startHour, 0, 0, 0);
          const end = new Date(start);
          end.setHours(start.getHours() + 1);
          setDateStart(start.toISOString());
          setDateEnd(end.toISOString());

          console.log('--- DADOS PARA DUPLICAÇÃO CARREGADOS ---');
        } catch (err) {
           console.error("Erro ao carregar evento para duplicação", err);
           alert("Erro ao carregar dados para duplicação.");
        } finally {
           setLoading(false);
        }
      };

      loadDuplicateEvent();
    } else if (eventIdParam) {
      console.log('--- MODO EDIÇÃO DETECTADO ---', { eventIdParam });
      setEditingEventId(eventIdParam);
      setIsEditing(true);
      setLoading(true);

      const loadEvent = async () => {
        try {
          console.log('--- BUSCANDO DADOS DO EVENTO ---', eventIdParam);
          const event = await pb.collection(Collections.AgendaCap53Eventos).getOne(eventIdParam);
          console.log('--- DADOS DO EVENTO RECEBIDOS ---', event);
          
          setTitle(event.title || '');
          setOriginalTitle(event.title || '');
          setType(event.type || '');
          setResponsibility(event.event_responsibility || '');
          setInvolvementLevel(event.creator_role || 'PARTICIPANTE');
          setObservacoes(event.observacoes || event.description || '');
          setCreatorId(event.user);
          
          // Check for external location (saved as null in location field but has custom_location)
          if (event.location === 'external' || (!event.location && event.custom_location)) {
            setLocationState({ mode: 'free', fixedId: 'external', freeText: event.custom_location || '' });
          } else {
            setLocationState({ mode: 'fixed', fixedId: event.location || '', freeText: '' });
          }
          
          const formatDate = (isoString: string) => {
             const date = new Date(isoString);
             if (isNaN(date.getTime())) return '';
             const year = date.getFullYear();
             const month = String(date.getMonth() + 1).padStart(2, '0');
             const day = String(date.getDate()).padStart(2, '0');
             const hours = String(date.getHours()).padStart(2, '0');
             const minutes = String(date.getMinutes()).padStart(2, '0');
             return `${year}-${month}-${day}T${hours}:${minutes}`;
          };
          
          setDateStart(formatDate(event.date_start || ''));
          setDateEnd(formatDate(event.date_end || ''));
          
          setSelectedParticipants(event.participants || []);
          setOriginalParticipants(event.participants || []);
          setParticipantRoles(event.participants_roles || {});
          setSelectedUnidades(event.unidades || []);
          setSelectedCategorias(event.categorias_profissionais || []);
          setEnvolverProfissionais(((event.unidades?.length || 0) > 0 || (event.categorias_profissionais?.length || 0) > 0));
          setTransporteSuporte(!!event.transporte_suporte);
          setTransporteOrigem(event.transporte_origem || '');
          setTransporteDestino(event.transporte_destino || '');
          setTransporteHorarioLevar(event.transporte_horario_levar || '');
          setTransporteHorarioBuscar(event.transporte_horario_buscar || '');
          setTransportePassageiros(event.transporte_passageiro ? String(event.transporte_passageiro) : '');
          setTransporteObs(event.transporte_obs || '');
          setOriginalTransporteSuporte(!!event.transporte_suporte);
          setIsRestricted(!!event.is_restricted);
          setEstimatedParticipants(event.estimated_participants ? String(event.estimated_participants) : '');
          
          // Fetch items
          console.log('--- BUSCANDO SOLICITAÇÕES DE LOGÍSTICA ---');
          const requests = await pb.collection(Collections.AgendaCap53AlmacRequests).getFullList({
             filter: `event = "${eventIdParam}"`,
             expand: 'item'
          });
          
          const newAlmoxarifadoItems: string[] = [];
          const newCopaItems: string[] = [];
          const newInformaticaItems: string[] = [];
          const newQuantities: {[key: string]: number} = {};
          
          requests.forEach((req: any) => {
             const item = req.expand?.item;
             if (item) {
                if (item.category === 'ALMOXARIFADO') {
                   newAlmoxarifadoItems.push(item.id);
                } else if (item.category === 'COPA') {
                   newCopaItems.push(item.id);
                } else if (item.category === 'INFORMATICA') {
                   newInformaticaItems.push(item.id);
                }
                newQuantities[item.id] = req.quantity || 1;
             }
          });
          
          setAlmoxarifadoItems(newAlmoxarifadoItems);
          setCopaItems(newCopaItems);
          setInformaticaItems(newInformaticaItems);
          setItemQuantities(newQuantities);
          setConfirmedItems([...newAlmoxarifadoItems, ...newCopaItems, ...newInformaticaItems]);
          setLogisticaRecursos(newAlmoxarifadoItems.length > 0 || newCopaItems.length > 0 || newInformaticaItems.length > 0 || !!event.transporte_suporte);
          console.log('--- CARREGAMENTO CONCLUÍDO ---');
        } catch (err) {
           console.error("Erro ao carregar evento", err);
           alert("Erro ao carregar evento para edição.");
        } finally {
           setLoading(false);
        }
      };
      
      loadEvent();
    } else if (dateParam) {
      // Parse YYYY-MM-DD as local date to avoid timezone issues
      const [year, month, day] = dateParam.split('-').map(Number);
      
      // Obter o horário atual e calcular a próxima hora cheia
      const now = new Date();
      const startHour = now.getHours() + 1;
      
      // Criar as datas usando o construtor local para preservar o fuso horário do usuário
      // A diferença de uma hora entre início e fim é garantida aqui na inicialização
      const start = new Date(year, month - 1, day, startHour, 0, 0, 0);
      const end = new Date(year, month - 1, day, startHour + 1, 0, 0, 0);

      // Usar toISOString() para garantir consistência com o CustomDatePicker e PocketBase
      setDateStart(start.toISOString());
      setDateEnd(end.toISOString());
    } else {
      // Caso a página seja aberta sem parâmetros (ex: via sidebar),
      // define o horário inicial como a próxima hora cheia de hoje.
      const now = new Date();
      const startHour = now.getHours() + 1;
      
      const start = new Date();
      start.setHours(startHour, 0, 0, 0);
      
      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      setDateStart(start.toISOString());
      setDateEnd(end.toISOString());
    }
  }, [searchParams]);

  useEffect(() => {
    if (!envolverProfissionais) {
      setSelectedUnidades([]);
      setSelectedCategorias([]);
    }
  }, [envolverProfissionais]);

  useEffect(() => {
    if (!logisticaRecursos) {
      setAlmoxarifadoItems([]);
      setCopaItems([]);
      setInformaticaItems([]);
      setTransporteSuporte(false);
      // We don't necessarily need to clear itemQuantities or confirmedItems 
      // as they are managed when items are added/removed, but we could if needed.
    }
  }, [logisticaRecursos]);

  useEffect(() => {
    if (responsibility === 'EXTERNO_COMPROMISSO') {
      setEstimatedParticipants('');
      // Force all participants to be 'PARTICIPANTE' if it's an external event
      setParticipantRoles(prev => {
        const newRoles = { ...prev };
        Object.keys(newRoles).forEach(key => {
          newRoles[key] = 'PARTICIPANTE';
        });
        return newRoles;
      });
    }
  }, [responsibility]);

  useEffect(() => {
    console.log('--- CreateEvent: useEffect para fetchInitialData acionado ---');
    const fetchInitialData = async () => {
      try {
        console.log('--- BUSCANDO DADOS INICIAIS ---');
        
        // Fetch locations
         try {
            console.log('--- BUSCANDO LOCAIS ---');
            const locs = await pb.collection('agenda_cap53_locais').getFullList<LocaisResponse>({
              sort: 'name'
            });
            console.log('--- BUSCA DE LOCAIS CONCLUÍDA, TOTAL: ---', locs.length);
            
            // Validação: remover duplicatas por ID
            const uniqueLocs = locs.filter((loc, index, self) => 
              index === self.findIndex(l => l.id === loc.id)
            );
            
            setLocations(uniqueLocs);
          } catch (err) {
            console.error("Erro ao buscar locais:", err);
            // Fallback: garantir que pelo menos a opção externa esteja disponível
            setLocations([]);
          }

        // Fetch event types
        try {
          const types = await pb.collection(Collections.AgendaCap53TiposEvento).getFullList<TiposEventoResponse>({
            sort: 'name',
            filter: 'active = true'
          });
          setEventTypes(types);
        } catch (err) {
          console.error("Erro ao buscar tipos de evento:", err);
          setEventTypes([]);
        }

        // Fetch items
        try {
          const items = await pb.collection('agenda_cap53_itens_servico').getFullList<ItensServicoResponse>({ sort: 'name' });
          console.log('--- DEBUG: Itens do Evento ---', items.length);
          setAvailableItems(items);
        } catch (err) {
          console.error("Erro ao buscar itens:", err);
        }

        // Fetch users
        try {
          setLoadingUsers(true);
          const users = await pb.collection(Collections.AgendaCap53Usuarios).getFullList<UsersResponse>({
            sort: 'name',
            fields: 'id,name,role,sector,avatar,email,collectionId,collectionName,hidden',
            filter: 'hidden != true',
            requestKey: null
          });
          console.log('--- DEBUG: Usuários do Evento ---', users.length);
          setAvailableUsers(users);
        } catch (err) {
          console.error("Erro ao buscar usuários:", err);
        } finally {
          setLoadingUsers(false);
        }

        console.log('--- BUSCA DE DADOS INICIAIS CONCLUÍDA ---');
      } catch (err) {
        console.error("Erro global em fetchInitialData:", err);
      }
    };

    fetchInitialData();

    let unsubscribe: (() => void) | undefined;

    // Subscribe to changes
    const setupSubscription = async () => {
      try {
        const unsubItems = await pb.collection(Collections.AgendaCap53ItensServico).subscribe('*', (e) => {
          if (e.action === 'update' || e.action === 'create') {
            setAvailableItems(prev => {
              const exists = prev.find(i => i.id === e.record.id);
              if (exists) {
                return prev.map(i => i.id === e.record.id ? e.record : i);
              }
              return [...prev, e.record].sort((a, b) => a.name.localeCompare(b.name));
            });
          } else if (e.action === 'delete') {
            setAvailableItems(prev => prev.filter(i => i.id !== e.record.id));
          }
        });

        const unsubTypes = await pb.collection(Collections.AgendaCap53TiposEvento).subscribe('*', (e) => {
          if (e.action === 'update' || e.action === 'create') {
            setEventTypes(prev => {
              const exists = prev.find(t => t.id === e.record.id);
              if (exists) {
                // If it became inactive, remove it from the list
                if (!e.record.active) {
                  return prev.filter(t => t.id !== e.record.id);
                }
                return prev.map(t => t.id === e.record.id ? e.record : t).sort((a, b) => a.name.localeCompare(b.name));
              }
              // Only add if active
              return e.record.active ? [...prev, e.record].sort((a, b) => a.name.localeCompare(b.name)) : prev;
            });
          } else if (e.action === 'delete') {
            setEventTypes(prev => prev.filter(t => t.id !== e.record.id));
          }
        });

        const unsubLocs = await pb.collection(Collections.AgendaCap53Locais).subscribe('*', (e) => {
          if (e.action === 'update' || e.action === 'create') {
            setLocations(prev => {
              const exists = prev.find(l => l.id === e.record.id);
              if (exists) {
                return prev.map(l => l.id === e.record.id ? e.record : l).sort((a, b) => a.name.localeCompare(b.name));
              }
              return [...prev, e.record].sort((a, b) => a.name.localeCompare(b.name));
            });
          } else if (e.action === 'delete') {
            setLocations(prev => prev.filter(l => l.id !== e.record.id));
          }
        });

        const unsubUsers = await pb.collection(Collections.AgendaCap53Usuarios).subscribe('*', (e) => {
          if (e.action === 'update') {
            setAvailableUsers(prev => {
              return prev.map(u => u.id === e.record.id ? { ...u, ...e.record } : u);
            });
          }
        });

        unsubscribe = () => {
          unsubItems();
          unsubTypes();
          unsubLocs();
          unsubUsers();
        };
      } catch (err) {
        console.error("Erro ao configurar inscrições em tempo real:", err);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    console.log('--- estado de locais atualizado ---', locations.length);
    console.log('Locais atuais no estado:', locations.map(l => l.name));
  }, [locations]);

  useEffect(() => {
    console.log('--- estado availableUsers alterado ---', availableUsers.length);
  }, [availableUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== INÍCIO DA SUBMISSÃO DO FORMULÁRIO ===');
    if (!user) { 
      console.log('Falha na validação: Usuário não autenticado'); 
      alert('Você precisa estar logado para realizar esta ação.');
      return; 
    }
    if (!dateStart || !dateEnd) {
      alert('Por favor, selecione os horários de início e término.');
      return;
    }
    if (new Date(dateStart) >= new Date(dateEnd)) {
      alert('A data de início não pode ser posterior ou igual à data de término.');
      return;
    }
    if (isDurationInvalid) {
      console.log('Falha na validação: Duração muito longa');
      alert('A duração do evento não pode exceder 23 horas e 59 minutos.');
      return;
    }

    if (selectedUnidades.length > 0 && selectedCategorias.length === 0) {
      console.log('Falha na validação: Unidades selecionadas sem categorias');
      alert('Por favor, selecione pelo menos uma categoria profissional para as unidades envolvidas.');
      return;
    }

    if (transporteSuporte) {
      if (!transporteOrigem || !transporteDestino || !transporteHorarioLevar || !transporteHorarioBuscar) {
        console.log('Falha na validação: Campos de transporte ausentes');
        alert('Por favor, preencha todos os campos obrigatórios de transporte (Origem, Destino, Horário de Ida e Volta).');
        return;
      }
      if (isTransportTimeInvalid) {
        console.log('Falha na validação: Horários de transporte inválidos');
        alert('O horário de ida não pode ser posterior ou igual ao horário de volta.');
        return;
      }
    }

    // Check for unavailable items
    const selectedItemIds = [...almoxarifadoItems, ...copaItems, ...informaticaItems];
    const unavailableSelectedItems = availableItems.filter(i => selectedItemIds.includes(i.id) && i.is_available === false);
    
    if (unavailableSelectedItems.length > 0) {
      console.log('Falha na validação: Itens indisponíveis selecionados');
      const itemNames = unavailableSelectedItems.map(i => i.name).join(', ');
      alert(`Os seguintes itens estão indisponíveis no momento e devem ser removidos antes de salvar: ${itemNames}`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setIsConflictCheckLoading(true);
    try {
      console.log('Observações antes do salvamento:', observacoes);
      
      // PocketBase filter dates should be in UTC "YYYY-MM-DD HH:MM:SS.SSSZ" format for best compatibility
      const toPBDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().replace('T', ' ');
      };

      const startFilter = toPBDate(dateStart);
      const endFilter = toPBDate(dateEnd);

      if (!startFilter || !endFilter) {
        throw new Error("Datas inválidas para o filtro de conflitos.");
      }

      // Location Conflict Check
      const selectedLoc = locations.find(l => l.id === locationState.fixedId);
      if (locationState.mode === 'fixed' && selectedLoc && normalizeBoolean(selectedLoc.conflict_control)) {
        let filter = `location = "${locationState.fixedId}" && status != "canceled" && date_start < "${endFilter}" && date_end > "${startFilter}"`;
        if (isEditing && editingEventId) {
           filter += ` && id != "${editingEventId}"`;
        }
        
        console.log('DEBUG: Verificando conflitos de localização:', { location: selectedLoc.name, filter });

        try {
          const conflicts = await pb.collection(Collections.AgendaCap53Eventos).getList(1, 1, {
            filter: filter,
            requestKey: null
          });

          if (conflicts.totalItems > 0) {
            setConflictModalData({
              title: 'Bloqueio: Conflito de Local!',
              message: `O local selecionado já está reservado para o evento "${conflicts.items[0].title}" neste horário.`,
              details: `Local em conflito: ${selectedLoc.name}`,
              type: 'danger'
            });
            setIsConflictModalOpen(true);
            setIsConflictCheckLoading(false);
            setLoading(false); 
            return;
          }
        } catch (err: any) {
          console.error('Falha na verificação de conflito de localização:', err);
          // If it's a 403, it's likely API Rules. We should still allow saving but warn the user.
          if (err.status === 403) {
            console.warn('Regras da API restringiram a verificação de conflito. Prosseguindo com cautela.');
          } else {
            throw err; // Re-throw other errors (like 400)
          }
        }
      }

      // Professional Category Conflict Check
      if (selectedCategorias.length > 0 && selectedUnidades.length > 0) {
        // Build filter parts carefully
        const categoryParts = selectedCategorias.map(cat => `categorias_profissionais ~ "${cat.replace(/"/g, '\\"')}"`);
        const unitParts = selectedUnidades.map(unit => `unidades ~ "${unit.replace(/"/g, '\\"')}"`);
        
        const categoryFilters = categoryParts.length > 1 ? `(${categoryParts.join(' || ')})` : categoryParts[0];
        const unitFilters = unitParts.length > 1 ? `(${unitParts.join(' || ')})` : unitParts[0];
        
        let categoryFilter = `${categoryFilters} && ${unitFilters} && status != "canceled" && date_start < "${endFilter}" && date_end > "${startFilter}"`;
        
        if (isEditing && editingEventId) {
          categoryFilter += ` && id != "${editingEventId}"`;
        }

        console.log('DEBUG: Verificando conflitos de categoria e unidade:', {
          selectedCategorias,
          selectedUnidades,
          startFilter,
          endFilter,
          filter: categoryFilter
        });

        try {
          const categoryConflicts = await pb.collection(Collections.AgendaCap53Eventos).getList(1, 1, {
            filter: categoryFilter,
            requestKey: null
          });

          console.log('DEBUG: Conflitos de categoria/unidade encontrados:', categoryConflicts.totalItems);

          if (categoryConflicts.totalItems > 0) {
            const firstConflict = categoryConflicts.items[0];
            const conflictCats = firstConflict.categorias_profissionais || [];
            const matchingCats = selectedCategorias.filter(c => conflictCats.includes(c));
            const conflictUnits = firstConflict.unidades || [];
            const matchingUnits = selectedUnidades.filter(u => conflictUnits.includes(u));
            
            setConflictModalData({
              title: 'Atenção: Conflito de Categoria!',
              message: `O evento "${firstConflict.title}" já possui categorias profissionais idênticas agendadas para as mesmas unidades neste horário.`,
              details: `Categorias em conflito: ${matchingCats.join(', ')}\nUnidades em conflito: ${matchingUnits.join(', ')}`,
              type: 'warning'
            });
            setIsConflictModalOpen(true);
            setIsConflictCheckLoading(false);
            setLoading(false);
            return;
          }
        } catch (err: any) {
          console.error('Falha na verificação de conflito de categoria:', err);
          if (err.status === 403) {
            console.warn('Regras da API restringiram a verificação de conflito. Prosseguindo com cautela.');
          } else {
            throw err;
          }
        }
      }

      // If no conflicts or confirmed, save the event
      setIsConflictCheckLoading(false);
      await saveEvent();
    } catch (err: any) {
      setIsConflictCheckLoading(false);
      console.error("Erro ao processar submissão:", err);
      alert(`Erro: ${err.message || 'Erro desconhecido'}`);
      setLoading(false);
    }
  };

  const toggleArrayItem = (array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setArray(prev => {
      if (prev.includes(item)) {
        // Remove item and its quantity
        const newQuantities = { ...itemQuantities };
        delete newQuantities[item];
        setItemQuantities(newQuantities);
        setConfirmedItems(prevC => prevC.filter(id => id !== item));
        return prev.filter(i => i !== item);
      } else {
        // Add item with default quantity 1
        setItemQuantities(prevQ => ({ ...prevQ, [item]: 1 }));
        return [...prev, item];
      }
    });
  };

  const handleQuantityChange = (item: any, qty: number) => {
    if (qty < 1) return;
    setItemQuantities(prev => ({ ...prev, [item.id]: qty }));
  };

  const renderResourceItem = (item: any, selectedItems: string[], setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>) => {
    const isSelected = selectedItems.includes(item.id);
    const isAvailable = item.is_available ?? true;
    
    // An item is clickable if it's available OR if it's already selected (to allow deselecting)
    const isClickable = isAvailable || isSelected;

    if (!isAvailable && !isSelected) {
      return (
        <div key={item.id} className="flex items-center rounded-xl border border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed h-10 pr-1">
          <div className="flex-1 h-full px-4 flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.name}</span>
            <span className="text-[8px] font-bold text-red-500 uppercase tracking-widest">Indisponível</span>
          </div>
          <span className="material-symbols-outlined text-slate-300 text-lg pr-2">block</span>
        </div>
      );
    }

    return (
      <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center rounded-[20px] border-2 transition-all duration-300 min-h-[48px] py-2 sm:py-0 ${isSelected ? 'bg-slate-900 border-slate-900 shadow-lg sm:pr-1.5' : (isAvailable ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50' : 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed')}`}>
        <button 
          type="button" 
          disabled={!isClickable}
          onClick={() => toggleArrayItem(selectedItems, setSelectedItems, item.id)}
          className={`flex-1 h-full px-4 py-2 sm:py-0 text-[11px] font-bold uppercase tracking-wider text-left transition-all ${isSelected ? 'text-white' : (isAvailable ? 'text-slate-600' : 'text-slate-300')}`}
        >
          <div className="flex flex-col leading-tight">
            <span className={!isAvailable && isSelected ? 'line-through opacity-70' : ''}>{item.name}</span>
            <span className={`text-[8px] normal-case font-medium ${!isAvailable ? 'text-red-500 font-bold' : (isSelected ? 'text-emerald-400 font-bold' : 'text-emerald-500 font-bold')}`}>
              {isAvailable ? (isSelected ? 'Selecionado' : 'Disponível') : (isSelected ? 'Indisponível (Remover)' : 'Indisponível')}
            </span>
          </div>
        </button>
        
        {isSelected && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2 sm:px-0 sm:pb-0 sm:pr-2 h-full animate-in fade-in zoom-in-95 duration-200 border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0 mt-1 sm:mt-0">
              <div className="flex items-center bg-white/10 rounded-xl border border-white/20 p-1">
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleQuantityChange(item, (itemQuantities[item.id] || 1) - 1); }}
                  className="size-6 flex items-center justify-center rounded-lg hover:bg-white/20 hover:shadow-sm text-white/70 hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <input
                  type="number"
                  min="1"
                  value={itemQuantities[item.id] || 1}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleQuantityChange(item, parseInt(e.target.value) || 1)}
                  className="w-8 h-6 text-[11px] font-bold text-center bg-transparent text-white outline-none border-none"
                />
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleQuantityChange(item, (itemQuantities[item.id] || 1) + 1); }}
                  className="size-6 flex items-center justify-center rounded-lg hover:bg-white/20 hover:shadow-sm text-white/70 hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
              </div>
              {item.unit && <span className="text-[10px] font-bold text-white/50 min-w-[24px]">{item.unit}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-[#1e293b] font-sans selection:bg-primary/10">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/2 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/2 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-[1300px] mx-auto px-6 py-3 relative z-10 flex flex-col gap-6 pb-28 md:pb-6">

        <form id="create-event-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col gap-4">

          {/* Row 1: Essential Data & Participants (Balanced Height) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch relative z-30">
            {/* Essential Information Card */}
            <section className="lg:col-span-8 relative z-20 bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] h-full flex flex-col gap-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                <div className="size-12 rounded-2xl bg-primary text-white shadow-lg transition-all duration-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl font-bold">bolt</span>
                </div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">Dados Essenciais</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Título da Atividade</label>
                  <input
                    required value={title} onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-14 px-6 rounded-2xl bg-white border border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none font-semibold text-sm text-slate-900 transition-all duration-300 placeholder:text-slate-500"
                    placeholder="Ex: Reunião Geral de Indicadores"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Tipo & Natureza</label>
                  <CustomSelect
                    value={type}
                    onChange={setType}
                    placeholder="Selecione o tipo..."
                    required
                    className="h-14 font-semibold"
                    options={orderedEventTypeOptions}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Localização</label>
                  <LocationField
                    value={locationState}
                    onChange={setLocationState}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Data & Início</label>
                  <CustomDatePicker
                    required
                    value={dateStart}
                    tabIndex={-1}
                    onChange={(val) => {
                      setDateStart(val);
                      // Auto-update end date to +1 hour
                      if (val) {
                        const start = new Date(val);
                        if (!isNaN(start.getTime())) {
                          const end = new Date(start.getTime() + 60 * 60 * 1000); // + 1 hour
                          setDateEnd(end.toISOString());
                        }
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Término Previsto</label>
                  <CustomDatePicker
                    required
                    value={dateEnd}
                    tabIndex={-1}
                    onChange={setDateEnd}
                  />
                </div>

                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 block truncate" title="Responsabilidade pela organização">Responsabilidade pela organização</label>
                  <CustomSelect
                    value={responsibility}
                    onChange={(val) => {
                      setResponsibility(val);
                      if (val === 'EXTERNO_COMPROMISSO') {
                        setInvolvementLevel('PARTICIPANTE');
                      } else if (!val) {
                        setInvolvementLevel('');
                      }
                    }}
                    placeholder="Selecione a responsabilidade..."
                    required
                    className="h-14 font-semibold"
                    options={RESPONSIBILITY_LEVELS}
                  />
                </div>

                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 block truncate" title="Nível de Envolvimento">Nível de Envolvimento</label>
                  <CustomSelect
                    value={involvementLevel}
                    onChange={setInvolvementLevel}
                    placeholder={responsibility ? "Selecione o nível..." : "Selecione a responsabilidade primeiro"}
                    required
                    className={`h-14 font-semibold ${!responsibility ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                    disabled={!responsibility}
                    options={INVOLVEMENT_LEVELS.filter(level => {
                      if (responsibility === 'EXTERNO_COMPROMISSO') {
                        return level.value === 'PARTICIPANTE';
                      }
                      return true;
                    })}
                  />
                </div>

                {isDateInvalid && (
                  <div className="md:col-span-2 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="material-symbols-outlined text-red-500 text-xl">error</span>
                    <span className="text-[11px] font-bold text-red-600 uppercase tracking-tight">
                      A data de início não pode ser posterior à data de término.
                    </span>
                  </div>
                )}

                {isDurationInvalid && (
                  <div className="md:col-span-2 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="material-symbols-outlined text-amber-500 text-xl">timer_off</span>
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-tight">
                      A duração máxima permitida para um evento é de 23 horas e 59 minutos.
                    </span>
                  </div>
                )}

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Observações Adicionais</label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Informações relevantes sobre o evento (objetivos, pautas, orientações)..."
                    className="w-full min-h-[120px] p-5 rounded-2xl bg-white border border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none font-semibold text-sm text-slate-900 transition-all duration-300 placeholder:text-slate-500 resize-none"
                  />
                </div>

                {/* Event Restriction Toggle & Estimated Presentes */}
                <div className="md:col-span-1 space-y-2 pt-2">
                  <div className="h-4" /> {/* Spacer for label alignment */}
                  <button
                    type="button"
                    onClick={() => setIsRestricted(!isRestricted)}
                    className={`w-full h-20 flex items-center justify-between p-5 rounded-[2rem] border transition-all duration-300 ${isRestricted ? 'bg-amber-50/60 border-amber-200 shadow-sm' : 'bg-slate-100/50 border-slate-300 hover:border-slate-400'}`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className={`size-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isRestricted ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-slate-200 text-slate-600'}`}>
                        <span className="material-symbols-outlined text-[22px]">{isRestricted ? 'lock' : 'lock_open'}</span>
                      </div>
                      <div>
                        <h4 className={`text-[11px] font-bold uppercase tracking-[0.1em] ${isRestricted ? 'text-amber-900' : 'text-slate-900'}`}>
                          {isRestricted ? 'Evento Restrito' : 'Evento Aberto'}
                        </h4>
                        <p className={`text-[10px] font-bold leading-relaxed ${isRestricted ? 'text-amber-700' : 'text-slate-600'}`}>
                          {isRestricted 
                            ? 'Apenas convidados podem participar.' 
                            : 'Usuários podem solicitar participação.'}
                        </p>
                      </div>
                    </div>
                    <div className={`size-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isRestricted ? 'bg-amber-500 border-amber-600 shadow-sm' : 'border-slate-400'}`}>
                      {isRestricted && <span className="material-symbols-outlined text-white text-[18px] font-bold">check</span>}
                    </div>
                  </button>
                </div>

                <div className="md:col-span-1 space-y-2 pt-2">
                  <div className="h-4" /> {/* Spacer for label alignment */}
                  <div className={`w-full h-20 flex items-center gap-4 p-4 rounded-[2rem] border transition-all duration-300 ${responsibility === 'EXTERNO_COMPROMISSO' ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed' : 'border-slate-400 bg-white focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5'}`}>
                    <div className={`size-12 rounded-2xl ${responsibility === 'EXTERNO_COMPROMISSO' ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-600'} flex items-center justify-center shrink-0 transition-all duration-300 group-focus-within:bg-primary group-focus-within:text-white group-focus-within:shadow-lg group-focus-within:shadow-primary/20`}>
                      <span className="material-symbols-outlined text-[24px]">groups</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <label className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.1em] truncate mb-0.5">Qtd. Estimada de Presentes</label>
                      <input
                        type="number"
                        min="1"
                        value={estimatedParticipants}
                        onChange={(e) => setEstimatedParticipants(e.target.value)}
                        disabled={responsibility === 'EXTERNO_COMPROMISSO'}
                        className={`w-full bg-transparent border-none outline-none font-black text-sm p-0 h-5 placeholder:text-slate-500 ${responsibility === 'EXTERNO_COMPROMISSO' ? 'text-slate-500' : 'text-slate-900'}`}
                        placeholder="Ex: 50"
                        title={responsibility === 'EXTERNO_COMPROMISSO' ? 'Indisponível para Participações externas' : undefined}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Participants Picker */}
            <section className="lg:col-span-4 relative z-10 bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] h-full flex flex-col gap-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary text-white shadow-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">person_add</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase tracking-widest">Convidar</h3>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Participantes</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-widest border border-primary/20">
                    {selectedParticipants.length}
                  </div>
                </div>
              </div>

              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors duration-300">person_search</span>
                <input
                  type="text" placeholder="Pesquisar..." value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)}
                  className="w-full h-11 pl-11 pr-10 rounded-xl bg-white border border-slate-400 outline-none font-bold text-sm text-slate-900 focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all duration-300 placeholder:text-slate-500"
                />
                {participantSearch && (
                  <button 
                    onClick={() => setParticipantSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1.5 custom-scrollbar flex-1 -mx-1 px-1 min-h-0">
                {loadingUsers ? (
                  <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-4">
                    <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest animate-pulse text-primary/70">Carregando usuários...</span>
                  </div>
                ) : (
                  <>
                    {availableUsers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-slate-500 gap-2">
                        <span className="material-symbols-outlined text-4xl opacity-30 text-primary">group_off</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Nenhum usuário disponível</span>
                      </div>
                    ) : sortedFilteredUsers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-slate-500 gap-2">
                        <span className="material-symbols-outlined text-4xl opacity-30">search_off</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Nenhum resultado encontrado</span>
                      </div>
                    ) : (
                      <>
                        {sortedFilteredUsers.slice(0, visibleParticipantsCount).map(u => {
                        const isSel = selectedParticipants.includes(u.id);
                        const isCreatorUser = u.id === user?.id;
                        
                        const avatarUrl = getAvatarUrl(u);

                        return (
                          <div
                            key={u.id}
                            onClick={(e) => {
                              // Se clicar nos botões de role não aciona o toggle do participante
                              if ((e.target as HTMLElement).closest('button')) return;
                              if (!isCreatorUser) {
                                toggleArrayItem(selectedParticipants, setSelectedParticipants, u.id);
                              }
                            }}
                            className={`flex flex-col gap-2 p-3.5 rounded-2xl border transition-all duration-300 ${!isCreatorUser ? 'cursor-pointer' : ''} ${
                              isSel 
                                ? 'bg-primary/5 border-primary/30 shadow-sm translate-x-1' 
                                : isCreatorUser
                                  ? 'bg-slate-100 border-slate-200 opacity-90 cursor-default'
                                  : 'bg-white border-slate-200 hover:border-primary/50 hover:bg-slate-50 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`size-10 rounded-full bg-cover bg-center border-2 ${isSel ? 'border-primary/30' : 'border-white shadow-sm'}`} style={{ backgroundImage: `url(${avatarUrl})` }} />
                              <div className="flex flex-col items-start min-w-0 flex-1 gap-0.5">
                                <span className={`text-xs font-black uppercase tracking-tight truncate w-full ${isSel ? 'text-primary' : 'text-slate-900'}`}>
                                  {u.name || (u.email ? u.email.split('@')[0] : 'Usuário')}
                                </span>
                                <div className="flex items-center gap-1.5 w-full">
                                  {u.sector && (
                                    <span className={`text-[10px] font-bold uppercase tracking-tight truncate ${isSel ? 'text-primary/60' : 'text-slate-600'}`}>
                                      {u.sector}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isCreatorUser ? (
                                <div className="bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 shrink-0">
                                  <span className="text-[10px] font-black uppercase tracking-widest">Você</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleArrayItem(selectedParticipants, setSelectedParticipants, u.id)}
                                  className={`material-symbols-outlined text-xl transition-all duration-300 shrink-0 ${isSel ? 'text-primary scale-110' : 'text-slate-400 hover:text-primary/60'}`}
                                >
                                  {isSel ? 'check_circle' : 'add_circle'}
                                </button>
                              )}
                            </div>
                            
                            {isSel && !isCreatorUser && (
                              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-primary/20">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black text-primary/70 uppercase tracking-widest">Nível de Envolvimento:</span>
                                  <span className="text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                    {INVOLVEMENT_LEVELS.find(l => l.value === (participantRoles[u.id] || 'PARTICIPANTE'))?.label || 'Selecione'}
                                  </span>
                                </div>
                                <div className={`grid gap-1 ${responsibility === 'EXTERNO_COMPROMISSO' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                  {INVOLVEMENT_LEVELS.filter(level => {
                                    // Se for evento externo, só permite PARTICIPANTE
                                    if (responsibility === 'EXTERNO_COMPROMISSO') {
                                      return level.value === 'PARTICIPANTE';
                                    }
                                    return true;
                                  }).map(level => {
                                    const isSelected = (participantRoles[u.id] || 'PARTICIPANTE') === level.value;
                                    const getIcon = (val: string) => {
                                      switch(val) {
                                        case 'ORGANIZADOR': return 'assignment_ind';
                                        default: return 'person';
                                      }
                                    };
                                    
                                    return (
                                      <button
                                        key={level.value}
                                        type="button"
                                        onClick={() => setParticipantRoles(prev => ({ ...prev, [u.id]: level.value }))}
                                        className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-all duration-300 border ${
                                          isSelected
                                            ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20 scale-[1.02] z-10'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-primary/40 hover:bg-white hover:text-primary active:scale-95'
                                        }`}
                                      >
                                        <span className={`material-symbols-outlined text-[14px] mb-0.5 ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                                          {getIcon(level.value)}
                                        </span>
                                        <span className="text-[7px] font-black uppercase tracking-tight leading-none text-center">
                                          {level.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {sortedFilteredUsers.length > visibleParticipantsCount && (
                        <button
                          type="button"
                          onClick={() => setVisibleParticipantsCount(prev => prev + 5)}
                          className="w-full py-2.5 text-[10px] font-black text-primary/80 uppercase tracking-widest hover:bg-primary/5 hover:text-primary rounded-xl transition-colors border border-primary/20 border-dashed mt-2 flex items-center justify-center gap-2 group"
                        >
                          <span className="material-symbols-outlined text-base group-hover:translate-y-0.5 transition-transform">expand_more</span>
                          <span>Carregar mais ({sortedFilteredUsers.length - visibleParticipantsCount})</span>
                        </button>
                      )}
                      </>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Row 2: Professional Scope (Full Width) - SWAPPED TO TOP */}
          <section className={`bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-4 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] flex flex-col gap-6 md:gap-8 relative z-10 ${!envolverProfissionais && 'opacity-90'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className={`size-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 shrink-0 ${envolverProfissionais ? 'bg-primary text-white shadow-primary/20' : 'bg-slate-200 text-slate-600'}`}>
                  <span className="material-symbols-outlined text-2xl font-bold">groups</span>
                </div>
                <div>
                  <h3 className={`text-lg md:text-xl font-bold tracking-tight transition-colors duration-500 ${envolverProfissionais ? 'text-slate-900' : 'text-slate-500'}`}>Envolvimento de Unidades e Profissionais</h3>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">Clique no botão ao lado para ativar e definir o público-alvo nas unidades</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnvolverProfissionais(!envolverProfissionais)}
                className={`group relative flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 px-6 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all duration-500 overflow-hidden ${envolverProfissionais ? 'bg-primary text-white shadow-xl shadow-primary/20 min-h-[48px]' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 min-h-[48px] sm:min-w-[420px]'}`}
              >
                <div className="flex items-center gap-3 relative z-10 sm:w-24">
                  <span className="relative flex h-2 w-2 shrink-0">
                    {envolverProfissionais && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${envolverProfissionais ? 'bg-green-500' : 'bg-slate-300 group-hover:bg-slate-400'}`}></span>
                  </span>
                  <span>{envolverProfissionais ? 'ATIVADO' : 'ATIVAR'}</span>
                </div>
                
                {!envolverProfissionais && (
                  <div className="hidden sm:flex items-center gap-2 relative z-10 ml-3 pl-4 border-l border-amber-200/50 group-hover:border-amber-300/80 transition-colors">
                    <div className="absolute inset-0 bg-amber-400/5 blur-md opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                    <span className="material-symbols-outlined text-[16px] text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] group-hover:drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] transition-all relative z-10">lightbulb</span>
                    <span className="text-[10px] font-semibold normal-case tracking-normal text-amber-600/90 group-hover:text-amber-700 transition-colors relative z-10">
                      Envolva unidades e categorias específicas
                    </span>
                  </div>
                )}
                {!envolverProfissionais && (
                  <div className="sm:hidden flex items-center justify-center gap-1.5 relative z-10 mt-1.5 bg-amber-50/80 px-3 py-1 rounded-full border border-amber-200/50 shadow-[0_0_10px_rgba(245,158,11,0.15)] w-[90%] max-w-[250px]">
                    <span className="material-symbols-outlined text-[14px] text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">lightbulb</span>
                    <span className="text-[9px] font-semibold normal-case tracking-normal text-amber-600/90 text-center">
                      Envolva unidades e categorias
                    </span>
                  </div>
                )}
              </button>
            </div>

            {envolverProfissionais && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in slide-in-from-top-4 duration-700 mt-10">
                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 ml-1 mb-1">
                      <label className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.2em]">Unidades Envolvidas</label>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const filteredUnits = Array.from(new Set([...UNIDADES, ...selectedUnidades]))
                              .filter(u => u.toLowerCase().includes(unitSearch.toLowerCase()));
                            
                            const allSelected = filteredUnits.every(u => selectedUnidades.includes(u));
                            
                            if (allSelected) {
                              // Deselect all filtered
                              setSelectedUnidades(prev => prev.filter(u => !filteredUnits.includes(u)));
                            } else {
                              // Select all filtered
                              setSelectedUnidades(prev => Array.from(new Set([...prev, ...filteredUnits])));
                            }
                          }}
                          className="text-[9px] font-bold text-primary hover:text-primary/70 uppercase tracking-widest transition-colors px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20"
                        >
                          {(() => {
                            const filteredUnits = Array.from(new Set([...UNIDADES, ...selectedUnidades]))
                              .filter(u => u.toLowerCase().includes(unitSearch.toLowerCase()));
                            const allSelected = filteredUnits.length > 0 && filteredUnits.every(u => selectedUnidades.includes(u));
                            return allSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo';
                          })()}
                        </button>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full whitespace-nowrap">{selectedUnidades.length} selecionadas</span>
                      </div>
                    </div>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-500 group-focus-within:text-slate-600 transition-colors">search</span>
                      <input
                        type="text"
                        placeholder="Pesquisar unidade..."
                        value={unitSearch}
                        onChange={(e) => setUnitSearch(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white border border-slate-400 outline-none font-bold text-sm text-slate-900 focus:border-slate-500 transition-all duration-300 placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar">
                    {unitSearch.trim() !== '' && !UNIDADES.some(u => u.toLowerCase() === unitSearch.toLowerCase()) && !selectedUnidades.some(u => u.toLowerCase() === unitSearch.toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => {
                          const newUnit = unitSearch.toUpperCase();
                          toggleArrayItem(selectedUnidades, setSelectedUnidades, newUnit);
                          setUnitSearch('');
                        }}
                        className="p-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-600 text-[10px] font-bold transition-all duration-300 text-center hover:border-slate-500 hover:text-slate-800 flex items-center justify-center gap-2 group"
                      >
                        <span className="material-symbols-outlined text-sm group-hover:rotate-90 transition-transform">add</span>
                        ADICIONAR "{unitSearch.toUpperCase()}"
                      </button>
                    )}
                    {Array.from(new Set([...UNIDADES, ...selectedUnidades]))
                      .filter(u => u.toLowerCase().includes(unitSearch.toLowerCase()))
                      .sort()
                      .map(u => (
                      <button
                        key={u} type="button"
                        onClick={() => toggleArrayItem(selectedUnidades, setSelectedUnidades, u)}
                        className={`p-3.5 rounded-2xl border text-[10px] font-bold transition-all duration-300 text-center relative overflow-hidden group ${selectedUnidades.includes(u) ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/50 hover:bg-slate-50'}`}
                      >
                        <span className="relative z-10">{u}</span>
                        {selectedUnidades.includes(u) && (
                          <span className="absolute top-1 right-1 material-symbols-outlined text-[12px] opacity-70">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6 relative">
                  <div className={`flex flex-col gap-3 transition-opacity duration-500 ${selectedUnidades.length === 0 ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 ml-1 mb-1">
                      <label className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.2em]">Categorias Profissionais</label>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const filteredCats = CATEGORIAS_PROFISSIONAIS
                              .filter(cp => cp.toLowerCase().includes(categorySearch.toLowerCase()));
                            
                            const allSelected = filteredCats.every(cp => selectedCategorias.includes(cp));
                            
                            if (allSelected) {
                              setSelectedCategorias(prev => prev.filter(cp => !filteredCats.includes(cp)));
                            } else {
                              setSelectedCategorias(prev => Array.from(new Set([...prev, ...filteredCats])));
                            }
                          }}
                          className="text-[9px] font-bold text-primary hover:text-primary/70 uppercase tracking-widest transition-colors px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20"
                        >
                          {(() => {
                            const filteredCats = CATEGORIAS_PROFISSIONAIS
                              .filter(cp => cp.toLowerCase().includes(categorySearch.toLowerCase()));
                            const allSelected = filteredCats.length > 0 && filteredCats.every(cp => selectedCategorias.includes(cp));
                            return allSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo';
                          })()}
                        </button>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${selectedCategorias.length > 0 ? 'text-slate-600 bg-slate-200' : 'text-red-600 bg-red-50 animate-pulse'}`}>
                          {selectedCategorias.length > 0 ? `${selectedCategorias.length} selecionadas` : 'OBRIGATÓRIO'}
                        </span>
                      </div>
                    </div>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-500 group-focus-within:text-slate-600 transition-colors">search</span>
                      <input
                        type="text"
                        placeholder="Pesquisar categoria..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white border border-slate-400 outline-none font-bold text-sm text-slate-900 focus:border-slate-500 transition-all duration-300 placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                  
                  {selectedUnidades.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-2xl z-10 p-6 text-center animate-in fade-in duration-500">
                      <div className="size-12 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-2xl">lock</span>
                      </div>
                      <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest leading-relaxed">
                        Selecione pelo menos uma unidade<br/>para liberar as categorias
                      </p>
                    </div>
                  )}

                  <div className={`grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar transition-all duration-500 ${selectedUnidades.length === 0 ? 'opacity-40' : 'opacity-100'}`}>
                    {CATEGORIAS_PROFISSIONAIS.filter(cp => cp.toLowerCase().includes(categorySearch.toLowerCase())).map(cp => (
                      <button
                        key={cp} type="button"
                        onClick={() => toggleArrayItem(selectedCategorias, setSelectedCategorias, cp)}
                        className={`w-full text-left p-4 rounded-2xl border-2 text-[10px] font-bold transition-all duration-300 flex items-center justify-between group ${selectedCategorias.includes(cp) ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/50 hover:bg-slate-50'}`}
                      >
                        <span className="uppercase tracking-tight">{cp}</span>
                        <span className={`material-symbols-outlined text-[16px] transition-all ${selectedCategorias.includes(cp) ? 'text-white rotate-0' : 'text-slate-300 rotate-90 opacity-0 group-hover:opacity-100'}`}>
                          {selectedCategorias.includes(cp) ? 'check_circle' : 'add_circle'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Row 3: Logistics (Full Width) - SWAPPED TO BOTTOM */}
          <section className={`bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-4 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] flex flex-col gap-6 md:gap-8 relative z-10 ${!logisticaRecursos && 'opacity-90'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className={`size-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 shrink-0 ${logisticaRecursos ? 'bg-primary text-white shadow-primary/20' : 'bg-slate-200 text-slate-600'}`}>
                  <span className="material-symbols-outlined text-2xl font-bold">inventory_2</span>
                </div>
                <div>
                  <h3 className={`text-lg md:text-xl font-bold tracking-tight transition-colors duration-500 ${logisticaRecursos ? 'text-slate-900' : 'text-slate-500'}`}>Logística & Recursos</h3>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">Clique no botão ao lado para ativar e solicitar insumos e apoio para o evento</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLogisticaRecursos(!logisticaRecursos)}
                className={`group relative flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 px-6 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all duration-500 overflow-hidden ${logisticaRecursos ? 'bg-primary text-white shadow-xl shadow-primary/20 min-h-[48px]' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 min-h-[48px] sm:min-w-[420px]'}`}
              >
                <div className="flex items-center gap-3 relative z-10 sm:w-24">
                  <span className="relative flex h-2 w-2 shrink-0">
                    {logisticaRecursos && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${logisticaRecursos ? 'bg-green-500' : 'bg-slate-300 group-hover:bg-slate-400'}`}></span>
                  </span>
                  <span>{logisticaRecursos ? 'ATIVADO' : 'ATIVAR'}</span>
                </div>

                {!logisticaRecursos && (
                  <div className="hidden sm:flex items-center gap-2 relative z-10 ml-3 pl-4 border-l border-amber-200/50 group-hover:border-amber-300/80 transition-colors">
                    <div className="absolute inset-0 bg-amber-400/5 blur-md opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                    <span className="material-symbols-outlined text-[16px] text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] group-hover:drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] transition-all relative z-10">lightbulb</span>
                    <span className="text-[10px] font-semibold normal-case tracking-normal text-amber-600/90 group-hover:text-amber-700 transition-colors relative z-10">
                      Solicite itens, veículos e coffeebreak
                    </span>
                  </div>
                )}
                {!logisticaRecursos && (
                  <div className="sm:hidden flex items-center justify-center gap-1.5 relative z-10 mt-1.5 bg-amber-50/80 px-3 py-1 rounded-full border border-amber-200/50 shadow-[0_0_10px_rgba(245,158,11,0.15)] w-[90%] max-w-[250px]">
                    <span className="material-symbols-outlined text-[14px] text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">lightbulb</span>
                    <span className="text-[9px] font-semibold normal-case tracking-normal text-amber-600/90 text-center">
                      Solicite itens, copa ou viaturas
                    </span>
                  </div>
                )}
              </button>
            </div>

            {logisticaRecursos && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col gap-8">
                {/* Tabs Navigation */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-slate-200 rounded-[22px] w-fit shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveTab('almoxarifado')}
                    className={`px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 ${activeTab === 'almoxarifado' ? 'bg-white text-slate-900 shadow-md border border-slate-300 scale-105' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                    Almoxarifado
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('copa')}
                    className={`px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 ${activeTab === 'copa' ? 'bg-white text-slate-900 shadow-md border border-slate-300 scale-105' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">local_cafe</span>
                    Serviços de Copa
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('informatica')}
                    className={`px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 ${activeTab === 'informatica' ? 'bg-white text-slate-900 shadow-md border border-slate-300 scale-105' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">laptop_mac</span>
                    Informática
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('transporte')}
                    className={`px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 ${activeTab === 'transporte' ? 'bg-white text-slate-900 shadow-md border border-slate-300 scale-105' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">directions_car</span>
                    Transporte
                  </button>
                </div>

                <div className="min-h-[200px] animate-in fade-in duration-500">
                  {/* Almoxarifado */}
                  {activeTab === 'almoxarifado' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl border transition-all duration-500 bg-white border-slate-400 shadow-xl shadow-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-black uppercase tracking-tight text-slate-900">Almoxarifado</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Insumos extras para a atividade</span>
                          </div>
                        </div>
                        
                        <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                          {availableItems
                            .filter(i => (i.category === 'ALMOXARIFADO') && ((i.is_available !== false) || almoxarifadoItems.includes(i.id)))
                            .map(item => renderResourceItem(item, almoxarifadoItems, setAlmoxarifadoItems))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Copa */}
                  {activeTab === 'copa' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl border transition-all duration-500 bg-white border-slate-400 shadow-xl shadow-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-black uppercase tracking-tight text-slate-900">Serviço de Copa</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Coffee, lanches e descartáveis</span>
                          </div>
                        </div>
                        
                        <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                          {availableItems
                            .filter(i => (i.category === 'COPA') && ((i.is_available !== false) || copaItems.includes(i.id)))
                            .map(item => renderResourceItem(item, copaItems, setCopaItems))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Informática */}
                  {activeTab === 'informatica' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl border transition-all duration-500 bg-white border-slate-400 shadow-xl shadow-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-black uppercase tracking-tight text-slate-900">Informática</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Recursos tecnológicos e apoio técnico</span>
                          </div>
                        </div>
                        
                        <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                          {availableItems
                            .filter(i => (i.category === 'INFORMATICA') && ((i.is_available !== false) || informaticaItems.includes(i.id)))
                            .map(item => renderResourceItem(item, informaticaItems, setInformaticaItems))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transporte */}
                  {activeTab === 'transporte' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl border transition-all duration-500 bg-white border-slate-400 shadow-xl shadow-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-black uppercase tracking-tight text-slate-900">Transporte</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Veículos, deslocamento e apoio logístico</span>
                          </div>
                        </div>
                        
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Local de Origem *</label>
                            <input 
                              type="text"
                              value={transporteOrigem}
                              tabIndex={activeTab === 'transporte' ? 0 : -1}
                              onChange={(e) => {
                                setTransporteOrigem(e.target.value);
                                if (e.target.value) setTransporteSuporte(true);
                              }}
                              placeholder="De onde o veículo deve sair?"
                              className="w-full h-12 px-5 rounded-2xl bg-white border border-slate-400 text-slate-900 font-bold text-sm focus:outline-none focus:border-slate-500 transition-all duration-300 placeholder:text-slate-500"
                            />
                          </div>
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Local de Destino *</label>
                            <input 
                              type="text"
                              value={transporteDestino}
                              tabIndex={activeTab === 'transporte' ? 0 : -1}
                              onChange={(e) => {
                                setTransporteDestino(e.target.value);
                                if (e.target.value) setTransporteSuporte(true);
                              }}
                              placeholder="Para onde o veículo deve ir?"
                              className="w-full h-12 px-5 rounded-2xl bg-white border border-slate-400 text-slate-900 font-bold text-sm focus:outline-none focus:border-slate-500 transition-all duration-300 placeholder:text-slate-500"
                            />
                          </div>

                          <CustomTimePicker
                            label="Horário de Ida (Levar) *"
                            value={transporteHorarioLevar}
                            placeholderTime={`${String((new Date().getHours() + 1) % 24).padStart(2, '0')}:00`}
                            tabIndex={activeTab === 'transporte' ? 0 : -1}
                            onChange={(val) => {
                              setTransporteHorarioLevar(val);
                              if (val) setTransporteSuporte(true);
                            }}
                          />
                          <CustomTimePicker
                            label="Horário de Volta (Buscar) *"
                            value={transporteHorarioBuscar}
                            placeholderTime={transporteHorarioLevar ? `${String((parseInt(transporteHorarioLevar.split(':')[0]) + 1) % 24).padStart(2, '0')}:00` : `${String((new Date().getHours() + 2) % 24).padStart(2, '0')}:00`}
                            tabIndex={activeTab === 'transporte' ? 0 : -1}
                            onChange={(val) => {
                              setTransporteHorarioBuscar(val);
                              if (val) setTransporteSuporte(true);
                            }}
                          />
                          <div className="md:col-span-2 space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Passageiros *</label>
                            <input 
                              type="number"
                              min="1"
                              value={transportePassageiros}
                              tabIndex={activeTab === 'transporte' ? 0 : -1}
                              onChange={(e) => {
                                setTransportePassageiros(e.target.value);
                                if (e.target.value) setTransporteSuporte(true);
                              }}
                              placeholder="Qtd."
                              className="w-full h-12 px-5 rounded-2xl bg-white border border-slate-400 text-slate-900 font-bold text-sm focus:outline-none focus:border-slate-500 transition-all duration-300 placeholder:text-slate-500"
                            />
                          </div>

                          {isTransportTimeInvalid && (
                            <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-100 border border-red-200 text-red-700 shadow-sm">
                                <span className="material-symbols-outlined text-lg">error</span>
                                <span className="text-xs font-black uppercase tracking-wider">O horário de ida não pode ser posterior ou igual ao horário de volta.</span>
                              </div>
                            </div>
                          )}

                          <div className="md:col-span-2 space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Observações Adicionais</label>
                            <textarea 
                              value={transporteObs}
                              tabIndex={activeTab === 'transporte' ? 0 : -1}
                              onChange={(e) => {
                                setTransporteObs(e.target.value);
                                if (e.target.value) setTransporteSuporte(true);
                              }}
                              placeholder="Ex: Quantidade de passageiros, volume de carga, ponto de referência específico..."
                              className="w-full min-h-[100px] p-5 rounded-2xl bg-white border border-slate-400 text-slate-900 font-bold text-sm focus:outline-none focus:border-slate-500 transition-all duration-300 placeholder:text-slate-500 resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Submit Button Section */}
          <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[100] transition-all duration-300">
            <button
              type="submit"
              disabled={loading || isDateInvalid || isDurationInvalid || isTransportTimeInvalid}
              className="h-14 w-14 md:w-auto md:px-8 bg-primary text-white rounded-full md:rounded-[20px] font-bold text-xs uppercase tracking-[0.15em] hover:bg-primary-hover hover:scale-105 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_40px_-10px_rgba(28,46,74,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(28,46,74,0.6)]"
              title={isEditing ? 'Salvar Alterações' : 'Agendar Atividade'}
            >
              {loading ? (
                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="hidden md:inline">{isEditing ? 'Salvar Alterações' : 'Agendar Atividade'}</span>
                  <span className="material-symbols-outlined text-[24px] md:text-xl group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">send</span>
                </>
              )}
            </button>
          </div>

          <div className="h-10" />

        </form>
      </div>

      {/* Floating Summary - Premium Minimalist */}
      {(envolverProfissionais || logisticaRecursos) && (
        <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[90] animate-in slide-in-from-bottom-10 fade-in duration-500 pointer-events-none">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 shadow-xl rounded-full p-1 md:p-1.5 flex items-center gap-1.5 md:gap-2 relative pointer-events-auto transition-all duration-300 hover:bg-slate-900 hover:scale-105">
            
            {/* Glow under the pill - More subtle */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-transparent to-emerald-500/20 rounded-full blur-[12px] pointer-events-none opacity-40" />

            {envolverProfissionais && (
              <div className="flex items-center gap-1.5 md:gap-2.5 px-2.5 py-1.5 md:px-4 md:py-2 rounded-full bg-slate-800/80 border border-slate-600/50 relative overflow-hidden group/env shadow-inner">
                <div className="absolute inset-0 bg-indigo-500/10 blur-md transition-opacity group-hover/env:opacity-100 opacity-60" />
                <span className="material-symbols-outlined text-[16px] md:text-[18px] text-indigo-300 relative z-10 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]">groups</span>
                <div className="flex items-center gap-1 md:gap-1.5 text-white font-bold text-[10px] md:text-[12px] relative z-10 tracking-wide">
                  <span className={selectedUnidades.length > 0 ? 'text-white' : 'text-slate-400 font-medium'}>
                    {selectedUnidades.length} <span className="text-indigo-200/80 font-bold">UNID</span>
                  </span>
                  <span className="text-slate-500 mx-0 md:mx-0.5">•</span>
                  <span className={selectedCategorias.length > 0 ? 'text-white' : 'text-slate-400 font-medium'}>
                    {selectedCategorias.length} <span className="text-indigo-200/80 font-bold">CAT</span>
                  </span>
                </div>
              </div>
            )}

            {logisticaRecursos && (
              <div className="flex items-center gap-1.5 md:gap-2.5 px-2.5 py-1.5 md:px-4 md:py-2 rounded-full bg-slate-800/80 border border-slate-600/50 relative overflow-hidden group/log shadow-inner">
                <div className="absolute inset-0 bg-emerald-500/10 blur-md transition-opacity group-hover/log:opacity-100 opacity-60" />
                <span className="material-symbols-outlined text-[16px] md:text-[18px] text-emerald-300 relative z-10 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]">inventory_2</span>
                <div className="flex items-center gap-1 md:gap-1.5 text-white font-bold text-[10px] md:text-[12px] relative z-10 tracking-wide">
                  {(almoxarifadoItems.length === 0 && copaItems.length === 0 && informaticaItems.length === 0 && !transporteOrigem && !transporteDestino) ? (
                    <span className="text-slate-400 font-medium">Vazio</span>
                  ) : (
                    <>
                      {almoxarifadoItems.length > 0 && <span>{almoxarifadoItems.length} <span className="text-emerald-200/80 font-bold">ALMX</span></span>}
                      {almoxarifadoItems.length > 0 && (copaItems.length > 0 || informaticaItems.length > 0 || transporteOrigem || transporteDestino) && <span className="text-slate-500 mx-0 md:mx-0.5">•</span>}
                      
                      {copaItems.length > 0 && <span>{copaItems.length} <span className="text-emerald-200/80 font-bold">COPA</span></span>}
                      {copaItems.length > 0 && (informaticaItems.length > 0 || transporteOrigem || transporteDestino) && <span className="text-slate-500 mx-0 md:mx-0.5">•</span>}
                      
                      {informaticaItems.length > 0 && <span>{informaticaItems.length} <span className="text-emerald-200/80 font-bold">INFO</span></span>}
                      {informaticaItems.length > 0 && (transporteOrigem || transporteDestino) && <span className="text-slate-500 mx-0 md:mx-0.5">•</span>}
                      
                      {(transporteOrigem || transporteDestino) && <span className="text-emerald-200 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)] font-bold">TRANSP</span>}
                    </>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <ConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onConfirm={async () => {
          setIsConflictModalOpen(false);
          await saveEvent();
        }}
        title={conflictModalData.title}
        message={conflictModalData.message}
        conflictDetails={conflictModalData.details}
        type={conflictModalData.type}
      />
    </div>
  );
};

export default CreateEvent;
