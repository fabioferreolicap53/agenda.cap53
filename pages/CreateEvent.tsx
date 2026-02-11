import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { notificationService } from '../lib/notifications';
import CustomSelect from '../components/CustomSelect';
import CustomDatePicker from '../components/CustomDatePicker';
import CustomTimePicker from '../components/CustomTimePicker';
import LocationField, { LocationState, normalizeBoolean } from '../components/LocationField';
import ConflictModal from '../components/ConflictModal';

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

const INVOLVEMENT_LEVELS = [
  { value: 'PARTICIPANTE', label: 'PARTICIPANTE' },
  { value: 'ORGANIZADOR', label: 'ORGANIZADOR' },
  { value: 'COORGANIZADOR', label: 'COORGANIZADOR' }
];

const CreateEvent: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
  const [locations, setLocations] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
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
  const [transporteObs, setTransporteObs] = useState('');
  const [originalTransporteSuporte, setOriginalTransporteSuporte] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
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
  const [isTransportTimeInvalid, setIsTransportTimeInvalid] = useState(false);
  const [isConflictCheckLoading, setIsConflictCheckLoading] = useState(false);
  // Quantity State
  const [itemQuantities, setItemQuantities] = useState<{ [itemId: string]: number }>({});
  const [confirmedItems, setConfirmedItems] = useState<string[]>([]);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});

  const [searchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);

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

    setLoading(true);
    try {
      // CustomDatePicker now returns proper ISO strings
      const startISO = dateStart.includes('Z') ? dateStart : new Date(dateStart).toISOString();
      const endISO = dateEnd.includes('Z') ? dateEnd : new Date(dateEnd).toISOString();

      // Initialize participants_status and participants_roles
      const participantsStatus: Record<string, string> = {};
      const participantsRoles: Record<string, string> = { ...participantRoles };
      
      // Ensure the creator/user is included in selectedParticipants if they are the one creating
      // but in this app, creator is separate from participants list usually.
      // However, if the user chose an involvementLevel, we should respect that for the creator's role record.
      const creatorRoleToUse = involvementLevel || 'ORGANIZADOR';

      selectedParticipants.forEach(pId => {
          if (!participantsRoles[pId]) {
            participantsRoles[pId] = creatorRoleToUse;
          }
          participantsStatus[pId] = 'pending';
      });

      let existingTransporteStatus: string | null = null;

      // Merge with existing status if editing
      if (isEditing && editingEventId) {
          try {
              const existingEvent = await pb.collection('agenda_cap53_eventos').getOne(editingEventId);
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

      const eventData = {
        title, type, 
        description: observacoes,
        observacoes,
        location: locationState.mode === 'fixed' ? locationState.fixedId : null, 
        custom_location: locationState.mode === 'free' ? locationState.freeText : null,
        date_start: startISO, date_end: endISO,
        participants: selectedParticipants, user: user?.id, status: 'active',
        almoxarifado_items: almoxarifadoItems, 
        copa_items: copaItems,
        informatica_items: informaticaItems,
        transporte: transporteSuporte,
        transporte_suporte: transporteSuporte,
        transporte_origem: transporteSuporte ? transporteOrigem : null,
        transporte_destino: transporteSuporte ? transporteDestino : null,
        transporte_horario_levar: transporteSuporte ? transporteHorarioLevar : null,
        transporte_horario_buscar: transporteSuporte ? transporteHorarioBuscar : null,
        transporte_obs: transporteSuporte ? transporteObs : null,
        unidades: selectedUnidades,
        categorias_profissionais: selectedCategorias,
        is_restricted: isRestricted,
        transporte_status: transporteSuporte ? (existingTransporteStatus || 'pending') : null,
        participants_status: participantsStatus,
        participants_roles: participantsRoles,
        creator_role: involvementLevel || 'PARTICIPANTE' // Default to PARTICIPANTE if empty
      };

      let eventId = editingEventId;

      if (isEditing && editingEventId) {
         await pb.collection('agenda_cap53_eventos').update(editingEventId, eventData);
         const newParticipants = selectedParticipants.filter(pId => !originalParticipants.includes(pId));
         if (newParticipants.length > 0) {
            try {
                // Create participante records for new participants
                await Promise.all(newParticipants.map(pId => 
                  pb.collection('agenda_cap53_participantes').create({
                    event: editingEventId,
                    user: pId,
                    status: 'pending',
                    role: participantsRoles[pId] || involvementLevel || 'ORGANIZADOR'
                  })
                ));

                await notificationService.bulkCreateNotifications(newParticipants, {
                    title: 'Convite para Evento',
                    message: `Você foi convidado para o evento "${title}" (edição).`,
                    type: 'event_invite',
                    event: editingEventId
                });
            } catch (notifErr) {
                console.error("Falha ao criar registros/notificações para novos participantes:", notifErr);
            }
         }
      } else {
         const created = await pb.collection('agenda_cap53_eventos').create(eventData);
         eventId = created.id;
         if (selectedParticipants.length > 0) {
          // Create participante records
          await Promise.all(selectedParticipants.map(participantId => 
            pb.collection('agenda_cap53_participantes').create({
              event: eventId,
              user: participantId,
              status: 'pending',
              role: participantsRoles[participantId] || involvementLevel || 'ORGANIZADOR'
            })
          ));

          // Send notifications using service
          await notificationService.bulkCreateNotifications(
            selectedParticipants.filter(pId => pId !== user?.id),
            {
              title: 'Novo Convite de Evento',
              message: `Você foi convidado para o evento "${title}".`,
              type: 'event_invite',
              event: eventId || undefined
            }
          );
         }
      }

      if (eventId) {
          try {
            const selectedItemIds = [...almoxarifadoItems, ...copaItems, ...informaticaItems];
            const existingRequests = await pb.collection('agenda_cap53_almac_requests').getFullList({
              filter: `event = "${eventId}"`,
            });

            const existingByItem = new Map<string, any>();
            existingRequests.forEach((r: any) => {
              if (r.item) existingByItem.set(r.item, r);
            });

            const removedRequests = existingRequests.filter((r: any) => r.item && !selectedItemIds.includes(r.item));
            if (removedRequests.length > 0) {
              await Promise.all(removedRequests.map((r: any) => pb.collection('agenda_cap53_almac_requests').delete(r.id)));
            }

            const createdRequests: any[] = [];
            for (const itemId of selectedItemIds) {
              const existing = existingByItem.get(itemId);
              const quantity = itemQuantities[itemId] || 1;
              const currentItem = availableItems.find(i => i.id === itemId);

              if (!existing) {
                const isAvailable = currentItem ? (currentItem.is_available !== false) : true;
                const createdReq = await pb.collection('agenda_cap53_almac_requests').create({
                  event: eventId,
                  item: itemId,
                  status: 'pending',
                  created_by: user?.id,
                  quantity,
                  item_snapshot_available: isAvailable
                });
                createdRequests.push(createdReq);
              } else if (existing.status === 'pending') {
                const updateData: any = {};
                if ((existing.quantity || 1) !== quantity) updateData.quantity = quantity;
                if (currentItem) {
                  const isAvailable = currentItem.is_available !== false;
                  if (existing.item_snapshot_available !== isAvailable) {
                    updateData.item_snapshot_available = isAvailable;
                  }
                }
                if (Object.keys(updateData).length > 0) {
                  await pb.collection('agenda_cap53_almac_requests').update(existing.id, updateData);
                  if (updateData.quantity) {
                    try {
                      const relatedNotifications = await pb.collection('agenda_cap53_notifications').getFullList({
                        filter: `related_request = "${existing.id}"`,
                      });
                      if (relatedNotifications.length > 0) {
                        const itemName = currentItem?.name || 'Item';
                        const newQuantity = updateData.quantity;
                        await Promise.all(relatedNotifications.map(notif => {
                          let newMessage = notif.message;
                          if (newMessage.includes('(Qtd:')) {
                            newMessage = newMessage.replace(/\(Qtd: \d+\)/, `(Qtd: ${newQuantity})`);
                          }
                          return pb.collection('agenda_cap53_notifications').update(notif.id, {
                            message: newMessage,
                            data: { ...notif.data, quantity: newQuantity }
                          });
                        }));
                      }
                    } catch (notifErr) { console.error("Erro ao atualizar notificações relacionadas:", notifErr); }
                  }
                }
              }
            }

            if (createdRequests.length > 0) {
              // Buscar usuários ALMC e DCA
              const sectorUsers = await pb.collection('agenda_cap53_usuarios').getFullList({ 
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

                  if (targetUserIds.length === 0) return [];

                  return notificationService.bulkCreateNotifications(
                    targetUserIds,
                    {
                      title: 'Solicitação de Item',
                      message: `O evento "${title}" solicitou o item "${itemNameById.get(req.item) || 'Item'}" (Qtd: ${req.quantity || 1}).`,
                      type: 'almc_item_request',
                      related_request: req.id,
                      event: eventId || undefined,
                      data: { kind: 'almc_item_request', quantity: req.quantity || 1, item: req.item }
                    }
                  );
                })
              );
            }

            if (transporteSuporte && (!isEditing || !originalTransporteSuporte)) {
      try {
        const traUsers = await pb.collection('agenda_cap53_usuarios').getFullList({ 
          filter: 'role = "TRA"' 
        });
        
        const traIds = traUsers
          .filter((traUser: any) => traUser.id !== user?.id)
          .map((traUser: any) => traUser.id);

        if (traIds.length > 0) {
          await notificationService.bulkCreateNotifications(
            traIds,
            {
              title: 'Solicitação de Transporte',
              message: `O evento "${title}" solicitou suporte de transporte.`,
              type: 'transport_request',
              event: eventId || undefined,
              data: { kind: 'transport_request' }
            }
          );
        }
      } catch (err) {
        console.error('Error creating TRA notifications:', err);
      }
    }
          } catch (reqErr: any) {
            console.error('Falha ao criar/atualizar solicitações de logística:', reqErr);
            alert(`Evento salvo, mas houve erro ao atualizar itens: ${reqErr.message || 'Erro desconhecido'}`);
          }
      }

      await pb.collection('agenda_audit_logs').create({
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
    const eventIdParam = searchParams.get('eventId') || searchParams.get('edit');
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

    if (eventIdParam) {
      console.log('--- MODO EDIÇÃO DETECTADO ---', { eventIdParam });
      setEditingEventId(eventIdParam);
      setIsEditing(true);
      setLoading(true);

      const loadEvent = async () => {
        try {
          console.log('--- BUSCANDO DADOS DO EVENTO ---', eventIdParam);
          const event = await pb.collection('agenda_cap53_eventos').getOne(eventIdParam);
          console.log('--- DADOS DO EVENTO RECEBIDOS ---', event);
          
          setTitle(event.title || '');
          setType(event.type || '');
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
          
          setDateStart(formatDate(event.date_start));
          setDateEnd(formatDate(event.date_end));
          
          setSelectedParticipants(event.participants || []);
          setOriginalParticipants(event.participants || []);
          setParticipantRoles(event.participants_roles || {});
          setSelectedUnidades(event.unidades || []);
          setSelectedCategorias(event.categorias_profissionais || []);
          setEnvolverProfissionais((event.unidades?.length > 0 || event.categorias_profissionais?.length > 0));
          setTransporteSuporte(!!event.transporte_suporte);
          setTransporteOrigem(event.transporte_origem || '');
          setTransporteDestino(event.transporte_destino || '');
          setTransporteHorarioLevar(event.transporte_horario_levar || '');
          setTransporteHorarioBuscar(event.transporte_horario_buscar || '');
          setTransporteObs(event.transporte_obs || '');
          setOriginalTransporteSuporte(!!event.transporte_suporte);
          setIsRestricted(!!event.is_restricted);
          
          // Fetch items
          console.log('--- BUSCANDO SOLICITAÇÕES DE LOGÍSTICA ---');
          const requests = await pb.collection('agenda_cap53_almac_requests').getFullList({
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
    console.log('--- CreateEvent: useEffect para fetchInitialData acionado ---');
    const fetchInitialData = async () => {
      try {
        console.log('--- BUSCANDO DADOS INICIAIS ---');
        
        // Fetch locations
         try {
            console.log('--- BUSCANDO LOCAIS ---');
            const locs = await pb.collection('agenda_cap53_locais').getFullList({
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
          const types = await pb.collection('agenda_cap53_tipos_evento').getFullList({
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
          const items = await pb.collection('agenda_cap53_itens_servico').getFullList({ sort: 'name' });
          console.log('--- DEBUG: Itens do Evento ---', items.length);
          setAvailableItems(items);
        } catch (err) {
          console.error("Erro ao buscar itens:", err);
        }

        // Fetch users
        try {
          setLoadingUsers(true);
          const users = await pb.collection('agenda_cap53_usuarios').getFullList({
            sort: 'name',
            fields: 'id,name,role,sector,avatar,email',
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
        const unsubItems = await pb.collection('agenda_cap53_itens_servico').subscribe('*', (e) => {
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

        const unsubTypes = await pb.collection('agenda_cap53_tipos_evento').subscribe('*', (e) => {
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

        const unsubLocs = await pb.collection('agenda_cap53_locais').subscribe('*', (e) => {
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

        unsubscribe = () => {
          unsubItems();
          unsubTypes();
          unsubLocs();
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
          const conflicts = await pb.collection('agenda_cap53_eventos').getList(1, 1, {
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
          const categoryConflicts = await pb.collection('agenda_cap53_eventos').getList(1, 1, {
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
    const isConfirmed = confirmedItems.includes(item.id);
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
      <div key={item.id} className={`flex items-center rounded-xl border transition-all duration-300 h-10 ${isSelected ? (isConfirmed ? 'bg-slate-800 border-slate-800 shadow-sm pr-1' : 'bg-white border-slate-800 shadow-md pr-1') : (isAvailable ? 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50' : 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed')}`}>
        <button 
          type="button" 
          disabled={!isClickable}
          onClick={() => toggleArrayItem(selectedItems, setSelectedItems, item.id)}
          className={`flex-1 h-full px-4 text-[10px] font-bold uppercase tracking-wider text-left transition-all ${isSelected ? (isConfirmed ? 'text-white' : 'text-slate-800') : (isAvailable ? 'text-slate-400' : 'text-slate-300')}`}
        >
          <div className="flex flex-col leading-tight">
            <span className={!isAvailable && isSelected ? 'line-through opacity-70' : ''}>{item.name}</span>
            <span className={`text-[8px] normal-case font-medium ${!isAvailable ? 'text-red-500 font-bold' : 'text-green-500'}`}>
              {isAvailable ? 'Disponível' : (isSelected ? 'Indisponível (Remover)' : 'Indisponível')}
            </span>
          </div>
        </button>
        
        {isSelected && !isConfirmed && (
          <div className="flex items-center gap-2 px-2 animate-in fade-in zoom-in-95 duration-200 border-l border-slate-100">
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleQuantityChange(item, (itemQuantities[item.id] || 1) - 1); }}
                  className="size-6 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <input
                  type="number"
                  min="1"
                  value={itemQuantities[item.id] || 1}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleQuantityChange(item, parseInt(e.target.value) || 1)}
                  className="w-8 h-6 text-[11px] font-bold text-center bg-transparent text-slate-800 outline-none border-none"
                />
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleQuantityChange(item, (itemQuantities[item.id] || 1) + 1); }}
                  className="size-6 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
              </div>
              {item.unit && <span className="text-[10px] font-bold text-slate-400 min-w-[24px]">{item.unit}</span>}
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmedItems(prev => [...prev, item.id]); }}
                className="size-7 rounded-lg bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 shadow-sm transition-all active:scale-90"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
              </button>
          </div>
        )}

        {isSelected && isConfirmed && (
           <div 
              onClick={(e) => { e.stopPropagation(); setConfirmedItems(prev => prev.filter(id => id !== item.id)); }}
              className="flex items-center gap-2 px-3 h-full cursor-pointer hover:bg-white/10 rounded-r-xl transition-colors border-l border-white/10"
           >
              <span className="text-[10px] font-bold text-white opacity-90">
                {itemQuantities[item.id] || 1} {item.unit || ''}
              </span>
              <span className="material-symbols-outlined text-[16px] text-white/50">edit</span>
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

      <div className="max-w-[1300px] mx-auto px-6 py-3 relative z-10 flex flex-col gap-6">

        <form id="create-event-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col gap-4">

          {/* Row 1: Essential Data & Participants (Balanced Height) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch relative z-30">
            {/* Essential Information Card */}
            <section className="lg:col-span-8 relative z-20 bg-white/60 backdrop-blur-2xl border border-slate-200 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] h-full flex flex-col gap-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-100/50">
                <div className="size-12 rounded-2xl bg-slate-800 text-white shadow-lg transition-all duration-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl font-bold">bolt</span>
                </div>
                <h3 className="text-lg font-bold tracking-tight text-slate-800">Dados Essenciais</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Título da Atividade</label>
                  <input
                    required value={title} onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-14 px-6 rounded-2xl bg-[#f8fafc]/50 border border-[#e2e8f0]/60 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none font-semibold text-sm transition-all duration-300 placeholder:text-[#94a3b8]/60"
                    placeholder="Ex: Reunião Geral de Indicadores"
                  />
                </div>

                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Nível de Envolvimento</label>
                  <CustomSelect
                    value={involvementLevel}
                    onChange={setInvolvementLevel}
                    placeholder="Selecione o nível..."
                    required
                    className="h-14"
                    options={INVOLVEMENT_LEVELS}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1">Tipo & Natureza</label>
                  <CustomSelect
                    value={type}
                    onChange={setType}
                    placeholder="Selecione o tipo..."
                    required
                    className="h-14"
                    options={eventTypes.map(t => ({ value: t.name, label: t.name }))}
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
                    className="w-full min-h-[120px] p-5 rounded-2xl bg-[#f8fafc]/50 border border-[#e2e8f0]/60 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none font-semibold text-sm transition-all duration-300 placeholder:text-[#94a3b8]/60 resize-none"
                  />
                </div>

                {/* Event Restriction Toggle */}
                <div className="md:col-span-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRestricted(!isRestricted)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${isRestricted ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className={`size-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isRestricted ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'bg-slate-200 text-slate-500'}`}>
                        <span className="material-symbols-outlined text-xl">{isRestricted ? 'lock' : 'lock_open'}</span>
                      </div>
                      <div>
                        <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isRestricted ? 'text-amber-800' : 'text-slate-700'}`}>
                          {isRestricted ? 'Evento Restrito' : 'Evento Aberto'}
                        </h4>
                        <p className={`text-[10px] font-medium leading-relaxed ${isRestricted ? 'text-amber-600/80' : 'text-slate-400'}`}>
                          {isRestricted 
                            ? 'O evento continua visível, mas apenas convidados podem participar. Novas solicitações estão bloqueadas.' 
                            : 'O evento é visível para todos e usuários podem solicitar participação livremente.'}
                        </p>
                      </div>
                    </div>
                    <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isRestricted ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'}`}>
                      {isRestricted && <span className="material-symbols-outlined text-sm">check</span>}
                    </div>
                  </button>
                </div>
              </div>
            </section>

            {/* Participants Picker */}
            <section className="lg:col-span-4 relative z-10 bg-white/60 backdrop-blur-2xl border border-slate-200 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] h-full flex flex-col gap-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-slate-900 text-white shadow-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">person_add</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-800 uppercase tracking-widest">Convidar</h3>
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">Participantes</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-widest border border-primary/10">
                    {selectedParticipants.length}
                  </div>
                </div>
              </div>

              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors duration-300">person_search</span>
                <input
                  type="text" placeholder="Pesquisar..." value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)}
                  className="w-full h-11 pl-11 pr-10 rounded-xl bg-slate-50 border border-slate-200 outline-none font-semibold text-[11px] focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all duration-300"
                />
                {participantSearch && (
                  <button 
                    onClick={() => setParticipantSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1.5 custom-scrollbar flex-1 -mx-1 px-1 min-h-0">
                {loadingUsers ? (
                  <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-4">
                    <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest animate-pulse text-primary/60">Carregando usuários...</span>
                  </div>
                ) : (
                  <>
                    {availableUsers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
                        <span className="material-symbols-outlined text-4xl opacity-20 text-primary">group_off</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Nenhum usuário disponível</span>
                      </div>
                    ) : sortedFilteredUsers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
                        <span className="material-symbols-outlined text-4xl opacity-20">search_off</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Nenhum resultado encontrado</span>
                      </div>
                    ) : (
                      sortedFilteredUsers.map(u => {
                        const isSel = selectedParticipants.includes(u.id);
                        const isCreatorUser = u.id === user?.id;
                        const avatarUrl = u.avatar 
                          ? (u.avatar.startsWith('http') ? u.avatar : pb.files.getUrl(u, u.avatar))
                          : `https://picsum.photos/seed/${u.email}/200`;

                        return (
                          <div
                            key={u.id}
                            className={`flex flex-col gap-2 p-3.5 rounded-2xl border transition-all duration-300 ${
                              isSel 
                                ? 'bg-primary/5 border-primary/20 shadow-sm translate-x-1' 
                                : isCreatorUser
                                  ? 'bg-slate-50 border-slate-100 opacity-80 cursor-default'
                                  : 'bg-white border-slate-100 hover:border-primary/40 hover:bg-slate-50/50 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`size-10 rounded-full bg-cover bg-center border-2 ${isSel ? 'border-primary/20' : 'border-white shadow-sm'}`} style={{ backgroundImage: `url(${avatarUrl})` }} />
                              <div className="flex flex-col items-start min-w-0 flex-1 gap-0.5">
                                <span className={`text-[11px] font-bold uppercase tracking-tight truncate w-full ${isSel ? 'text-primary' : 'text-slate-700'}`}>
                                  {u.name || (u.email ? u.email.split('@')[0] : 'Usuário')}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isSel ? 'text-primary/60' : 'text-slate-400'}`}>
                                  {u.role || (u.id === user?.id ? 'Criador' : 'Participante')}
                                </span>
                                  {u.sector && (
                                    <>
                                      <span className={`size-1 rounded-full ${isSel ? 'bg-primary/20' : 'bg-slate-300'}`} />
                                      <span className={`text-[9px] font-medium uppercase tracking-tight ${isSel ? 'text-primary/40' : 'text-slate-400/70'}`}>
                                        {u.sector}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {isCreatorUser ? (
                                <div className="bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/10">
                                  <span className="text-[8px] font-black uppercase tracking-widest">Você</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleArrayItem(selectedParticipants, setSelectedParticipants, u.id)}
                                  className={`material-symbols-outlined text-xl transition-all duration-300 ${isSel ? 'text-primary scale-110' : 'text-slate-300 hover:text-primary/40'}`}
                                >
                                  {isSel ? 'check_circle' : 'add_circle'}
                                </button>
                              )}
                            </div>
                            
                            {isSel && !isCreatorUser && (
                              <div className="flex items-center gap-2 mt-1 pt-2 border-t border-primary/10">
                                <span className="text-[8px] font-bold text-primary/60 uppercase tracking-widest">Nível:</span>
                                <div className="flex gap-1 flex-1">
                                  {INVOLVEMENT_LEVELS.map(level => (
                                    <button
                                      key={level.value}
                                      type="button"
                                      onClick={() => setParticipantRoles(prev => ({ ...prev, [u.id]: level.value }))}
                                      className={`flex-1 py-1 rounded-lg text-[8px] font-bold transition-all duration-200 ${
                                        (participantRoles[u.id] || involvementLevel) === level.value
                                          ? 'bg-primary text-white shadow-sm'
                                          : 'bg-white text-slate-400 border border-slate-100 hover:border-primary/30 hover:text-primary/60'
                                      }`}
                                    >
                                      {level.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Row 2: Professional Scope (Full Width) - SWAPPED TO TOP */}
          <section className={`bg-white/60 backdrop-blur-2xl border border-slate-200 rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] flex flex-col gap-8 relative z-10 ${!envolverProfissionais && 'opacity-90'}`}>
            <div className="flex items-center justify-between pb-6 border-b border-slate-100/50">
              <div className="flex items-center gap-4">
                <div className={`size-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${envolverProfissionais ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <span className="material-symbols-outlined text-2xl font-bold">groups</span>
                </div>
                <div>
                  <h3 className={`text-xl font-bold tracking-tight transition-colors duration-500 ${envolverProfissionais ? 'text-slate-800' : 'text-slate-400'}`}>Envolvimento de Unidades e Profissionais</h3>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Defina o público-alvo nas unidades</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnvolverProfissionais(!envolverProfissionais)}
                className={`group flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all duration-500 ${envolverProfissionais ? 'bg-slate-800 text-white shadow-xl shadow-slate-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                <span className="relative flex h-2 w-2">
                  {envolverProfissionais && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${envolverProfissionais ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                </span>
                {envolverProfissionais ? 'ATIVADO' : 'DESATIVADO'}
              </button>
            </div>

            {envolverProfissionais && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in slide-in-from-top-4 duration-700 mt-10">
                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.2em]">Unidades Envolvidas</label>
                      <div className="flex items-center gap-2">
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
                          className="text-[9px] font-bold text-primary hover:text-primary/70 uppercase tracking-widest transition-colors px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10"
                        >
                          {(() => {
                            const filteredUnits = Array.from(new Set([...UNIDADES, ...selectedUnidades]))
                              .filter(u => u.toLowerCase().includes(unitSearch.toLowerCase()));
                            const allSelected = filteredUnits.length > 0 && filteredUnits.every(u => selectedUnidades.includes(u));
                            return allSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo';
                          })()}
                        </button>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{selectedUnidades.length} selecionadas</span>
                      </div>
                    </div>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-300 group-focus-within:text-slate-500 transition-colors">search</span>
                      <input
                        type="text"
                        placeholder="Pesquisar unidade..."
                        value={unitSearch}
                        onChange={(e) => setUnitSearch(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-[11px] text-slate-700 focus:bg-white focus:border-slate-400 transition-all duration-300"
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
                        className="p-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-400 text-[10px] font-bold transition-all duration-300 text-center hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-2 group"
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
                        className={`p-3.5 rounded-2xl border text-[10px] font-bold transition-all duration-300 text-center relative overflow-hidden group ${selectedUnidades.includes(u) ? 'bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-200 scale-[1.02]' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <span className="relative z-10">{u}</span>
                        {selectedUnidades.includes(u) && (
                          <span className="absolute top-1 right-1 material-symbols-outlined text-[12px] opacity-50">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6 relative">
                  <div className={`flex flex-col gap-3 transition-opacity duration-500 ${selectedUnidades.length === 0 ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.2em]">Categorias Profissionais</label>
                      <div className="flex items-center gap-2">
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
                          className="text-[9px] font-bold text-primary hover:text-primary/70 uppercase tracking-widest transition-colors px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10"
                        >
                          {(() => {
                            const filteredCats = CATEGORIAS_PROFISSIONAIS
                              .filter(cp => cp.toLowerCase().includes(categorySearch.toLowerCase()));
                            const allSelected = filteredCats.length > 0 && filteredCats.every(cp => selectedCategorias.includes(cp));
                            return allSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo';
                          })()}
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedCategorias.length > 0 ? 'text-slate-400 bg-slate-100' : 'text-red-500 bg-red-50 animate-pulse'}`}>
                          {selectedCategorias.length > 0 ? `${selectedCategorias.length} selecionadas` : 'OBRIGATÓRIO'}
                        </span>
                      </div>
                    </div>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-300 group-focus-within:text-slate-500 transition-colors">search</span>
                      <input
                        type="text"
                        placeholder="Pesquisar categoria..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-[11px] text-slate-700 focus:bg-white focus:border-slate-400 transition-all duration-300"
                      />
                    </div>
                  </div>
                  
                  {selectedUnidades.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px] rounded-2xl z-10 p-6 text-center animate-in fade-in duration-500">
                      <div className="size-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-2xl">lock</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                        Selecione pelo menos uma unidade<br/>para liberar as categorias
                      </p>
                    </div>
                  )}

                  <div className={`grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar transition-all duration-500 ${selectedUnidades.length === 0 ? 'opacity-40' : 'opacity-100'}`}>
                    {CATEGORIAS_PROFISSIONAIS.filter(cp => cp.toLowerCase().includes(categorySearch.toLowerCase())).map(cp => (
                      <button
                        key={cp} type="button"
                        onClick={() => toggleArrayItem(selectedCategorias, setSelectedCategorias, cp)}
                        className={`w-full text-left p-4 rounded-2xl border text-[10px] font-bold transition-all duration-300 flex items-center justify-between group ${selectedCategorias.includes(cp) ? 'bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-200' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <span className="uppercase tracking-tight">{cp}</span>
                        <span className={`material-symbols-outlined text-[16px] transition-all ${selectedCategorias.includes(cp) ? 'text-white rotate-0' : 'text-slate-200 rotate-90 opacity-0 group-hover:opacity-100'}`}>
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
          <section className={`bg-white/60 backdrop-blur-2xl border border-slate-200 rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] flex flex-col gap-8 relative z-10 ${!logisticaRecursos && 'opacity-90'}`}>
            <div className="flex items-center justify-between pb-6 border-b border-slate-100/50">
              <div className="flex items-center gap-4">
                <div className={`size-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${logisticaRecursos ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <span className="material-symbols-outlined text-2xl font-bold">inventory_2</span>
                </div>
                <div>
                  <h3 className={`text-xl font-bold tracking-tight transition-colors duration-500 ${logisticaRecursos ? 'text-slate-800' : 'text-slate-400'}`}>Logística & Recursos</h3>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Solicite insumos e apoio para o evento</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLogisticaRecursos(!logisticaRecursos)}
                className={`group flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all duration-500 ${logisticaRecursos ? 'bg-slate-800 text-white shadow-xl shadow-slate-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                <span className="relative flex h-2 w-2">
                  {logisticaRecursos && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${logisticaRecursos ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                </span>
                {logisticaRecursos ? 'ATIVADO' : 'DESATIVADO'}
              </button>
            </div>

            {logisticaRecursos && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col gap-8">
                {/* Tabs Navigation */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/50 rounded-[22px] w-fit">
                  <button
                    type="button"
                    onClick={() => setActiveTab('almoxarifado')}
                    className={`px-6 py-3 rounded-[18px] text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 ${activeTab === 'almoxarifado' ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                    Almoxarifado
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('copa')}
                    className={`px-6 py-3 rounded-[18px] text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 ${activeTab === 'copa' ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">coffee</span>
                    Serviços de Copa
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('informatica')}
                    className={`px-6 py-3 rounded-[18px] text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 ${activeTab === 'informatica' ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">computer</span>
                    Informática
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('transporte')}
                    className={`px-6 py-3 rounded-[18px] text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 ${activeTab === 'transporte' ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">local_taxi</span>
                    Transporte
                  </button>
                </div>

                <div className="min-h-[200px] animate-in fade-in duration-500">
                  {/* Almoxarifado */}
                  {activeTab === 'almoxarifado' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl border transition-all duration-500 bg-white border-slate-200 shadow-xl shadow-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-bold uppercase tracking-tight text-slate-800">Almoxarifado</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Insumos extras para a atividade</span>
                          </div>
                        </div>
                        
                        <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                          {availableItems
                            .filter(i => (i.category === 'ALMOXARIFADO' || i.type === 'almoxarifado') && ((i.is_available !== false) || almoxarifadoItems.includes(i.id)))
                            .map(item => renderResourceItem(item, almoxarifadoItems, setAlmoxarifadoItems))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Copa */}
                  {activeTab === 'copa' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl border transition-all duration-500 bg-white border-slate-200 shadow-xl shadow-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-bold uppercase tracking-tight text-slate-800">Serviço de Copa</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Coffee, lanches e descartáveis</span>
                          </div>
                        </div>
                        
                        <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                          {availableItems
                            .filter(i => (i.category === 'COPA' || i.type === 'copa') && ((i.is_available !== false) || copaItems.includes(i.id)))
                            .map(item => renderResourceItem(item, copaItems, setCopaItems))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Informática */}
                  {activeTab === 'informatica' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl border transition-all duration-500 bg-white border-slate-200 shadow-xl shadow-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-bold uppercase tracking-tight text-slate-800">Informática</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Recursos tecnológicos e apoio técnico</span>
                          </div>
                        </div>
                        
                        <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                          {availableItems
                            .filter(i => (i.category === 'INFORMATICA' || i.type === 'informatica') && ((i.is_available !== false) || informaticaItems.includes(i.id)))
                            .map(item => renderResourceItem(item, informaticaItems, setInformaticaItems))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transporte */}
                  {activeTab === 'transporte' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl border transition-all duration-500 bg-white border-slate-200 shadow-xl shadow-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-bold uppercase tracking-tight text-slate-800">Transporte</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Veículos, deslocamento e apoio logístico</span>
                          </div>
                        </div>
                        
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Local de Origem *</label>
                            <input 
                              type="text"
                              value={transporteOrigem}
                              onChange={(e) => {
                                setTransporteOrigem(e.target.value);
                                if (e.target.value) setTransporteSuporte(true);
                              }}
                              placeholder="De onde o veículo deve sair?"
                              className="w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 font-medium text-sm focus:outline-none focus:border-slate-400 focus:bg-white transition-all duration-300"
                            />
                          </div>
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Local de Destino *</label>
                            <input 
                              type="text"
                              value={transporteDestino}
                              onChange={(e) => {
                                setTransporteDestino(e.target.value);
                                if (e.target.value) setTransporteSuporte(true);
                              }}
                              placeholder="Para onde o veículo deve ir?"
                              className="w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 font-medium text-sm focus:outline-none focus:border-slate-400 focus:bg-white transition-all duration-300"
                            />
                          </div>

                          <CustomTimePicker
                            label="Horário de Ida (Levar) *"
                            value={transporteHorarioLevar}
                            onChange={(val) => {
                              setTransporteHorarioLevar(val);
                              if (val) setTransporteSuporte(true);
                            }}
                          />
                          <CustomTimePicker
                            label="Horário de Volta (Buscar) *"
                            value={transporteHorarioBuscar}
                            onChange={(val) => {
                              setTransporteHorarioBuscar(val);
                              if (val) setTransporteSuporte(true);
                            }}
                          />

                          {isTransportTimeInvalid && (
                            <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600">
                                <span className="material-symbols-outlined text-lg">error</span>
                                <span className="text-xs font-bold uppercase tracking-wider">O horário de ida não pode ser posterior ou igual ao horário de volta.</span>
                              </div>
                            </div>
                          )}

                          <div className="md:col-span-2 space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Observações Adicionais</label>
                            <textarea 
                              value={transporteObs}
                              onChange={(e) => {
                                setTransporteObs(e.target.value);
                                if (e.target.value) setTransporteSuporte(true);
                              }}
                              placeholder="Ex: Quantidade de passageiros, volume de carga, ponto de referência específico..."
                              className="w-full min-h-[100px] p-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 font-medium text-sm focus:outline-none focus:border-slate-400 focus:bg-white transition-all duration-300 resize-none"
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
          <div className="flex justify-end pt-6 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading || isDateInvalid || isDurationInvalid || isTransportTimeInvalid}
              className="h-12 px-10 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-primary-hover active:scale-95 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 flex items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {loading ? (
                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isEditing ? 'Salvar Alterações' : 'Agendar Atividade'}</span>
                  <span className="material-symbols-outlined text-xl group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">send</span>
                </>
              )}
            </button>
          </div>

          <div className="h-10" />

        </form>
      </div>

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
