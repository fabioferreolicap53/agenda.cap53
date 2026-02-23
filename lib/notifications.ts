import { pb } from './pocketbase';

export type NotificationType =
  | 'event_invite'
  | 'cancellation'
  | 'service_request'
  | 'almc_item_request'
  | 'transport_request'
  | 'event_participation_request'
  | 'request_decision'
  | 'transport_decision'
  | 'info'
  | 'refusal'
  | 'acknowledgment'
  | 'system'
  | 'history_log';

export interface CreateNotificationParams {
  user: string;
  title: string;
  message: string;
  type: NotificationType;
  event?: string;
  related_request?: string;
  data?: any;
}

export interface NotificationRecord {
  id: string;
  user: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  event?: string;
  related_request?: string;
  invite_status?: 'pending' | 'accepted' | 'rejected' | 'confirmed' | 'approved';
  data?: any;
  meta?: any;
  acknowledged: boolean;
  created: string;
  updated: string;
  expand?: {
    event?: any;
    related_request?: any;
    user?: any;
    related_event?: any;
    created_by?: any;
    item?: any;
  };
}

/**
 * Centralized service for handling notifications.
 */
export const notificationService = {
  /**
   * Creates a notification for a user.
   * Prevents duplicates if the same user, event, and type are provided.
   */
  async createNotification(params: CreateNotificationParams) {
    const { user, title, message, type, event, related_request, data } = params;

    console.log('🔔 DEBUG createNotification:', { user, title, message, type, event, related_request });

    // 1. Prevent Duplicates for event invites
    if (type === 'event_invite' && event) {
      console.log('🔍 Verificando notificação duplicada...');
      const existing = await pb.collection('agenda_cap53_notifications').getList(1, 1, {
        filter: `user = "${user}" && event = "${event}" && type = "event_invite"`
      });

      if (existing.totalItems > 0) {
        console.log(`✅ Notificação já existe para usuário ${user} e evento ${event}`);
        return existing.items[0];
      }
    }

    // 2. Create the internal PocketBase notification
    console.log('💾 Tentando criar notificação no banco de dados...');
    console.log('📋 Dados completos:', { user, title, message, type, event, related_request, data });
    
    let notification;
    try {
      console.log('⏳ Iniciando create no PocketBase...');
      const startTime = Date.now();
      
      notification = await pb.collection('agenda_cap53_notifications').create({
        user,
        title,
        message,
        type,
        event,
        related_request,
        read: false,
        invite_status: (
          type === 'event_invite' || 
          type === 'event_participation_request' || 
          type === 'almc_item_request' || 
          type === 'transport_request' || 
          type === 'service_request'
        ) ? 'pending' : null,
        data,
        acknowledged: false
      });
      
      const endTime = Date.now();
      console.log(`✅ Notificação criada com sucesso! ID: ${notification.id} (tempo: ${endTime - startTime}ms)`);
      console.log('📊 Notificação completa:', notification);
      
    } catch (error: any) {
      console.error('❌ ERRO ao criar notificação:', error.message);
      console.error('📄 Tipo do erro:', error.constructor.name);
      console.error('📋 Detalhes do erro:', error.data || error);
      console.error('🔍 Stack:', error.stack);
      throw error;
    }

    // 3. Simulate Push/Email Notification
    console.log('📧 Simulando notificação externa...');
    this.simulateExternalNotification(params);

    // 4. Create Audit Log
    try {
      await pb.collection('agenda_audit_logs').create({
        user: pb.authStore.model?.id || 'system',
        action: 'NOTIFICATION_CREATED',
        target_type: 'agenda_cap53_notifications',
        target_id: notification.id,
        details: {
          recipient: user,
          type,
          title
        }
      });
    } catch (e) {
      console.error('Failed to log notification audit:', e);
    }

    return notification;
  },

  /**
   * Simulates sending push or email notifications.
   */
  simulateExternalNotification(params: CreateNotificationParams) {
    const { user, title, message, type } = params;
    
    console.group(`🔔 EXTERNAL NOTIFICATION SIMULATION [${type.toUpperCase()}]`);
    console.log(`To User ID: ${user}`);
    console.log(`Title: ${title}`);
    console.log(`Message: ${message}`);
    console.log(`Timestamp: ${new Date().toLocaleString()}`);
    console.log(`Status: Sent (Simulated)`);
    console.groupEnd();

    // In a real scenario, this would call a Firebase Cloud Messaging (FCM) 
    // or an email service like SendGrid/Mailgun.
  },

  /**
   * Creates notifications for multiple users.
   */
  async bulkCreateNotifications(userIds: string[], params: Omit<CreateNotificationParams, 'user'>) {
    console.log('🔔 DEBUG bulkCreateNotifications:', { userIds, params });
    
    const results = await Promise.allSettled(
      userIds.map(userId => {
        console.log(`📝 Criando notificação para usuário ${userId}...`);
        return this.createNotification({ ...params, user: userId });
      })
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value);
    const failed = results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason);
    
    console.log(`✅ bulkCreateNotifications concluído: ${successful.length} sucessos, ${failed.length} falhas`);
    if (failed.length > 0) {
      console.error('❌ Falhas:', failed);
    }
    
    return successful;
  }
};

/**
 * Checks if a notification can be deleted based on business rules.
 * Rule: Request notifications linked to an event cannot be deleted before the event starts.
 */
export const isNotificationDeletable = (notification: NotificationRecord): { canDelete: boolean; reason?: string } => {
  // Allow deletion if it's a cancellation notification or explicit refusal/info
  if (notification.type === 'cancellation' || notification.type === 'refusal' || notification.type === 'info') {
    return { canDelete: true };
  }

  // Check expand.event first, then try to see if event is an object (in case of virtual notifications mixed in)
  // Also check related_event as a fallback
  const event = notification.expand?.event || 
                (typeof notification.event === 'object' ? notification.event : null) ||
                notification.expand?.related_event;
  
  if (event) {
    // Check if the event has ended
    // We use date_end if available, otherwise fallback to date_start (assuming 1h duration or similar, but safer to stick to date_end)
    const eventEndDateStr = event.date_end || event.date_start;
    
    if (eventEndDateStr) {
      const eventEnd = new Date(eventEndDateStr);
      const now = new Date();
      
      // If the event hasn't ended yet (now < eventEnd), prevent deletion
      if (now < eventEnd) {
        return { 
          canDelete: false, 
          reason: 'Esta notificação está vinculada a um evento que ainda não terminou. Ela só poderá ser removida após o término do evento.' 
        };
      }
    }
  }
  
  return { canDelete: true };
};
