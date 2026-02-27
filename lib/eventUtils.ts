import { pb } from './pocketbase';
import { notifyEventStatusChange, EventData } from './notificationUtils';
import { EventsResponse, ParticipantesRecord, SolicitacoesEventoRecord } from './pocketbase-types';

/**
 * Calculates the estimated number of participants for an event.
 * Logic:
 * If 'estimated_participants' field is set, use it.
 * Otherwise:
 *   1 (Creator)
 *   + Count of participants (accepted + pending)
 *   + Count of requests (pending)
 *   - Count of declined participants (already excluded if we sum only accepted+pending)
 *   - Count of rejected requests (already excluded if we sum only pending)
 * 
 * So simplified:
 *   1 (Creator) + Count(Participants where status != 'declined') + Count(Requests where status == 'pending')
 * 
 * @param event The event object (must include expand.participants and expand.agenda_cap53_solicitacoes_evento_via_event)
 * @returns The estimated number of participants.
 */
export const getEstimatedParticipants = (event: EventsResponse<any>): number => {
    if (event.estimated_participants && event.estimated_participants > 0) {
        return event.estimated_participants;
    }

    let count = 1; // Creator (assumed attending unless declined explicitly in participants list?)

    // Participants
    const participants = event.expand?.participants as ParticipantesRecord[] || [];
    // Check if creator is already in participants list to avoid double counting
    const creatorInList = participants.some(p => p.user === event.user);
    if (creatorInList) {
        count = 0; // Will be counted in the loop below
    }

    // Count non-declined participants
    const validParticipants = participants.filter(p => p.status !== 'declined');
    count += validParticipants.length;

    // Requests (Pending)
    // Note: The reverse relation expand name might vary. Assuming 'agenda_cap53_solicitacoes_evento_via_event' based on standard PB naming for reverse relation.
    // Or it might be 'solicitacoes_evento(event)'.
    // We should check the actual expand property in the response or try both standard patterns.
    const requests = (event.expand?.['agenda_cap53_solicitacoes_evento(event)'] || event.expand?.solicitacoes_evento) as SolicitacoesEventoRecord[] || [];
    
    const pendingRequests = requests.filter(r => r.status === 'pending');
    count += pendingRequests.length;

    return count;
};

/**
 * Deletes an event and all its associated notifications.
 * This function performs a client-side cleanup as a fallback for the server-side hook.
 * 
 * @param eventId The ID of the event to delete.
 * @param actorId The ID of the user performing the deletion (optional, defaults to current auth user).
 */
export const deleteEventWithCleanup = async (eventId: string, actorId?: string) => {
    console.log(`[Event Cleanup] Starting deletion for event: ${eventId}`);

    // 0. Notify involved parties (Before deletion)
    try {
        const currentUserId = actorId || pb.authStore.model?.id;
        if (currentUserId) {
            const event = await pb.collection('agenda_cap53_eventos').getOne(eventId);
            if (event) {
                // Notifica exclusão
                await notifyEventStatusChange(event as unknown as EventData, 'deleted', '', currentUserId);
            }
        } else {
            console.warn('[Event Cleanup] No actor ID found, skipping deletion notification.');
        }
    } catch (e) {
        console.warn('[Event Cleanup] Failed to send deletion notifications:', e);
        // Continue with deletion even if notification fails
    }

    // 1. Delete associated notifications (Client-side fallback)
    try {
        // Fetch only IDs to minimize data transfer
        // Filter by either 'event' or 'related_event' to catch all associations
        const notifications = await pb.collection('agenda_cap53_notifications').getFullList({
            filter: `event = "${eventId}" || related_event = "${eventId}"`,
            fields: 'id',
            $autoCancel: false
        });
        
        console.log(`[Event Cleanup] Found ${notifications.length} notifications to delete.`);

        // Execute in batches to avoid overwhelming the server
        const batchSize = 5;
        for (let i = 0; i < notifications.length; i += batchSize) {
            const batch = notifications.slice(i, i + batchSize);
            await Promise.all(batch.map(n => 
                pb.collection('agenda_cap53_notifications').delete(n.id).catch(e => 
                    console.warn(`Failed to delete notification ${n.id}:`, e)
                )
            ));
        }
    } catch (err) {
        console.error('[Event Cleanup] Error cleaning up notifications:', err);
        // Continue to delete event even if cleanup fails
    }

    // 2. Delete the event
    console.log('[Event Cleanup] Deleting event record...');
    await pb.collection('agenda_cap53_eventos').delete(eventId);
    console.log('[Event Cleanup] Event deleted successfully.');
};
