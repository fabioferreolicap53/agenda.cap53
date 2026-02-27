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
 * Envolvidos: Participantes, Organizadores, Setores com solicitações aprovadas (ALMC, DCA, TRA).
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

    // Participantes via agenda_cap53_participantes
    try {
        const participantsList = await pb.collection('agenda_cap53_participantes').getFullList({
            filter: `event = "${event.id}"`,
            fields: 'user'
        });
        participantsList.forEach((p: any) => recipients.add(p.user));
    } catch (err) {
        // Ignora erro se não encontrar participantes
        console.warn('[NotificationUtils] Aviso ao buscar participantes:', err);
    }

    // Participantes diretos do objeto do evento (fallback/legado)
    if (event.participants && Array.isArray(event.participants)) {
        event.participants.forEach((p: string) => recipients.add(p));
    }
    
    // Criador do evento (Organizador)
    if (event.user && event.user !== actorId) {
        recipients.add(event.user);
    }

    try {
        // Busca usuários dos setores relevantes (ALMC, DCA, TRA)
        const sectorUsers = await pb.collection('agenda_cap53_usuarios').getFullList({
            filter: 'role ?~ "ALMC" || role ?~ "DCA" || role ?~ "TRA"',
            fields: 'id,role'
        });

        // Mapeia usuários por setor
        const usersByRole: Record<string, string[]> = {
            'ALMC': [],
            'DCA': [],
            'TRA': []
        };

        sectorUsers.forEach((u: any) => {
            if (u.role.includes('ALMC')) usersByRole['ALMC'].push(u.id);
            if (u.role.includes('DCA')) usersByRole['DCA'].push(u.id);
            if (u.role.includes('TRA')) usersByRole['TRA'].push(u.id);
        });

        // 1. Verifica solicitações de itens (Almoxarifado e Informática)
        // Otimização: Fazemos uma query simples para ver se existem pedidos aprovados
        const requests = await pb.collection('agenda_cap53_almac_requests').getFullList({
            filter: `event = "${event.id}" && status = "approved"`,
            expand: 'item',
            fields: 'expand.item.category'
        });

        const hasAlmc = requests.some((r: any) => r.expand?.item?.category !== 'INFORMATICA');
        const hasDca = requests.some((r: any) => r.expand?.item?.category === 'INFORMATICA');

        if (hasAlmc) usersByRole['ALMC'].forEach(uid => recipients.add(uid));
        if (hasDca) usersByRole['DCA'].forEach(uid => recipients.add(uid));

        // 2. Verifica transporte (verificando flag no evento ou status)
        // Se o evento tem suporte de transporte confirmado/pendente, notifica o setor
        if (event.transporte_suporte || event.transporte_status === 'confirmed' || event.transporte_status === 'approved') {
             usersByRole['TRA'].forEach(uid => recipients.add(uid));
        }

    } catch (err) {
        console.warn('[NotificationUtils] Erro ao buscar setores (pode ser ignorado se não houver permissão):', err);
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
            timestamp: new Date().toISOString(),
            estimated_participants: (event as any).estimated_participants
        }
    });
    
    console.log('[NotificationUtils] Notificações enviadas com sucesso.');
};
