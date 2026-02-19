import { pb } from './pocketbase';
import { notifyEventStatusChange, EventData } from './notificationUtils';

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
