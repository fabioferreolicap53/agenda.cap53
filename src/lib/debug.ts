/**
 * Sistema de debug controlado para diagnóstico de notificações
 * Use apenas em ambiente de desenvolvimento
 */

export const DEBUG_ENABLED = import.meta.env.DEV;

export function debugLog(component: string, message: string, data?: any) {
  if (!DEBUG_ENABLED) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${component}]`;
  
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

export function debugNotifications() {
  if (!DEBUG_ENABLED) return;
  
  // Função para debug de notificações no console
  (window as any).debugNotifications = () => {
    const notifications = JSON.parse(localStorage.getItem('debug_notifications') || '[]');
    console.table(notifications);
    return notifications;
  };
  
  console.log('Debug de notificações habilitado. Use debugNotifications() no console.');
}