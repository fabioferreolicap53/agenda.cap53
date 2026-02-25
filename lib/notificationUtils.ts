import { pb } from './pocketbase';
import { notificationService } from './notifications';

export interface EventData {
    id: string;
    title: string;
    participants?: string[];
    user?: string; // Criador
    transporte_status?: string;
    almoxarifado_confirmed_items?: any;
    copa_confirmed_items?: any;
    informatica_confirmed_items?: any;
    [key: string]: any; // Allow other properties from RecordModel
}

/**
 * Envia notificações para todos os envolvidos quando um evento é cancelado ou excluído.
 * Envolvidos: Participantes, Organizadores, Coorganizadores, Setores com solicitações aprovadas (ALMC, DCA, TRA).
 * 
 * @param event O objeto do evento.
 * @param action A ação realizada ('cancelled' ou 'deleted').
 * @param reason O motivo do cancelamento/exclusão.
 * @param actorId O ID do usuário que realizou a ação (para não ser notificado).
 */
export const notifyEventStatusChange = async (
    event: EventData,
    action: 'cancelled' | 'deleted',
    reason: string = '',
    actorId: string
) => {
    console.log(`[NotificationUtils] Iniciando notificação de ${action} para evento ${event.id}`);
    
    const recipients = new Set<string>();

    // Participantes e Co-organizadores via agenda_cap53_participantes
    try {
        const participantsList = await pb.collection('agenda_cap53_participantes').getFullList({
            filter: `event = "${event.id}"`,
            fields: 'user'
        });
        participantsList.forEach((p: any) => recipients.add(p.user));
    } catch (err) {
        console.error('[NotificationUtils] Erro ao buscar participantes do evento:', err);
    }

    // Participantes diretos do objeto do evento (fallback/legado)
    if (event.participants && Array.isArray(event.participants)) {
        event.participants.forEach((p: string) => recipients.add(p));
    }
    
    // Criador do evento (Organizador)
    if (event.user && event.user !== actorId) {
        recipients.add(event.user);
    }

    // Setores aprovados (ALMC, DCA, TRA)
    const sectorRoles = new Set<string>();

    try {
        // Busca solicitações de itens/serviços (ALMC e DCA)
        const requestFilter = `event = "${event.id}" && status = "approved"`;
        const almacRequests = await pb.collection('agenda_cap53_almac_requests').getFullList({
            filter: requestFilter,
            expand: 'item'
        });

        const hasAlmcRequest = almacRequests.some((r: any) => r.expand?.item?.category !== 'INFORMATICA');
        const hasDcaRequest = almacRequests.some((r: any) => r.expand?.item?.category === 'INFORMATICA');

        if (hasAlmcRequest) sectorRoles.add('ALMC');
        if (hasDcaRequest) sectorRoles.add('DCA');

        // Busca solicitações de transporte (TRA)
        const transportRequests = await pb.collection('agenda_cap53_transport_requests').getList(1, 1, {
            filter: `evento = "${event.id}" && status = "APPROVED"`,
            fields: 'id'
        });

        if (transportRequests.totalItems > 0) {
            sectorRoles.add('TRA');
        }

        // Adiciona os usuários dos setores identificados
        if (sectorRoles.size > 0) {
            const roleFilter = Array.from(sectorRoles).map(role => `role = "${role}"`).join(' || ');
            const sectorUsers = await pb.collection('agenda_cap53_usuarios').getFullList({
                filter: `(${roleFilter}) && hidden != true`,
                fields: 'id'
            });
            sectorUsers.forEach((u: any) => recipients.add(u.id));
        }

    } catch (err) {
        console.error('[NotificationUtils] Erro ao buscar setores para notificação:', err);
    }

    // Remover o autor da ação da lista de destinatários
    recipients.delete(actorId);

    if (recipients.size === 0) {
        console.log('[NotificationUtils] Nenhum destinatário para notificar.');
        return;
    }

    console.log(`[NotificationUtils] Enviando notificações para ${recipients.size} usuários.`);

    // Preparar dados da notificação
    const title = action === 'cancelled' ? 'Evento Cancelado' : 'Evento Excluído';
    let message = '';
    
    if (action === 'cancelled') {
        message = `O evento "${event.title}" foi cancelado.`;
        if (reason) message += ` Motivo: ${reason}`;
    } else {
        message = `O evento "${event.title}" foi excluído.`;
        if (reason) message += ` Motivo: ${reason}`;
    }

    // Se for exclusão, NÃO vinculamos o ID do evento no campo 'event' porque ele será deletado
    // e o cascade delete apagaria a notificação.
    const eventIdLink = action === 'cancelled' ? event.id : undefined;

    await notificationService.bulkCreateNotifications(Array.from(recipients), {
        title,
        message,
        type: 'cancellation', 
        event: eventIdLink,
        data: {
            original_event_id: event.id,
            original_event_title: event.title,
            action,
            reason,
            timestamp: new Date().toISOString()
        }
    });
    
    console.log('[NotificationUtils] Notificações enviadas com sucesso.');
};
