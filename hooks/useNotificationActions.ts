import { pb } from '../lib/pocketbase';
import { NotificationRecord, isNotificationDeletable } from '../lib/notifications';
import { useAuth } from '../components/AuthContext';

export const useNotificationActions = (
  notifications: NotificationRecord[],
  setNotifications: React.Dispatch<React.SetStateAction<NotificationRecord[]>>,
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>,
  refreshNotifications: () => Promise<void>
) => {
  const { user } = useAuth();

  const markAsRead = async (id: string) => {
    try {
      await pb.collection('agenda_cap53_notifications').update(id, { read: true });
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update badge
      if (navigator.setAppBadge) {
        const count = notifications.filter(n => !n.read && n.id !== id).length;
        if (count > 0) navigator.setAppBadge(count);
        else navigator.clearAppBadge();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      
      if (unreadIds.length === 0) return;
      
      // Process in batches of 20 to avoid timeouts
      const batchSize = 20;
      for (let i = 0; i < unreadIds.length; i += batchSize) {
        const batch = unreadIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(id => pb.collection('agenda_cap53_notifications').update(id, { read: true }))
        );
      }
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      if (navigator.clearAppBadge) navigator.clearAppBadge();
      
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    // Check if deletable
    const { canDelete, reason } = isNotificationDeletable(notification);
    
    if (!canDelete) {
      alert(reason || 'Esta notificação não pode ser excluída no momento.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta notificação?')) return;

    try {
      await pb.collection('agenda_cap53_notifications').delete(id);
      
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (!notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Erro ao excluir notificação.');
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    
    if (!confirm('Tem certeza que deseja limpar todo o histórico? Notificações pendentes não serão removidas.')) return;

    try {
      // Delete all notifications that are deletable (mostly read and history)
      const deletableIds = notifications
        .filter(n => isNotificationDeletable(n).canDelete)
        .map(n => n.id);
      
      if (deletableIds.length === 0) {
        alert('Não há notificações no histórico para limpar.');
        return;
      }

      const batchSize = 20;
      for (let i = 0; i < deletableIds.length; i += batchSize) {
        const batch = deletableIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(id => pb.collection('agenda_cap53_notifications').delete(id))
        );
      }
      
      refreshNotifications();
    } catch (error) {
      console.error('Error clearing history:', error);
      alert('Erro ao limpar histórico.');
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    
    if (!confirm('ATENÇÃO: Isso excluirá TODAS as suas notificações possíveis de serem excluídas. Continuar?')) return;

    try {
      const deletableIds = notifications
        .filter(n => isNotificationDeletable(n).canDelete)
        .map(n => n.id);
        
      const batchSize = 20;
      for (let i = 0; i < deletableIds.length; i += batchSize) {
        const batch = deletableIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(id => pb.collection('agenda_cap53_notifications').delete(id))
        );
      }
      
      refreshNotifications();
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  const handleDecision = async (notification: NotificationRecord, action: 'accepted' | 'rejected' | 'approved', justification?: string) => {
    if (!notification.related_request && !notification.event) return;

    try {
      // If it's a request decision
      if (notification.type === 'request_decision') {
        // Just mark as read and maybe update local state if needed
        await markAsRead(notification.id);
        return;
      }

      // If it's an invite or request needing action
      // Logic depends on the type. Assuming this function is called from a component that knows what to do,
      // or we implement the logic here.
      // For now, let's just log. The actual logic is likely in the component or needs to be moved here.
      console.log('Handling decision:', { id: notification.id, action, justification });
      
      // Example: Update invite status
      if (notification.type === 'event_invite') {
         // Call API to update invite
      }
      
      // After successful action, mark notification as processed/read
      await markAsRead(notification.id);
      refreshNotifications();
      
    } catch (error) {
      console.error('Error handling decision:', error);
      alert('Erro ao processar decisão.');
    }
  };

  return { 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearHistory, 
    clearAllNotifications, 
    handleDecision 
  };
};
