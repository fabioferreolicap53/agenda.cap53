import { pb } from './pocketbase';

export type NotificationType =
  | 'event_invite'
  | 'cancellation'
  | 'service_request'
  | 'almc_item_request'
  | 'transport_request'
  | 'event_participation_request'
  | 'info'
  | 'refusal'
  | 'acknowledgment'
  | 'system';

export interface CreateNotificationParams {
  user: string;
  title: string;
  message: string;
  type: NotificationType;
  event?: string;
  related_request?: string;
  data?: any;
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

    // 1. Prevent Duplicates for event invites
    if (type === 'event_invite' && event) {
      const existing = await pb.collection('agenda_cap53_notifications').getList(1, 1, {
        filter: `user = "${user}" && event = "${event}" && type = "event_invite"`
      });

      if (existing.totalItems > 0) {
        console.log(`Notification already exists for user ${user} and event ${event}`);
        return existing.items[0];
      }
    }

    // 2. Create the internal PocketBase notification
    const notification = await pb.collection('agenda_cap53_notifications').create({
      user,
      title,
      message,
      type,
      event,
      related_request,
      read: false,
      invite_status: type === 'event_invite' ? 'pending' : null,
      data,
      acknowledged: false
    });

    // 3. Simulate Push/Email Notification
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
    return Promise.all(
      userIds.map(userId => this.createNotification({ ...params, user: userId }))
    );
  }
};
