/// <reference path="../pb_data/types.d.ts" />

/**
 * HOOKS DE NOTIFICAÇÕES - AGÊNDA CAP53
 * 
 * ATENÇÃO: Todas as notificações disparadas por ações do usuário (Aprovar, Recusar, Re-solicitar)
 * foram migradas para o Frontend (useNotificationActions.ts e ReRequestModal.tsx).
 * 
 * Isso garante que o sistema siga o padrão "Frontend-First", evitando duplicidade
 * de notificações e garantindo que o payload contenha todos os dados necessários
 * para o agrupamento e exibição do histórico timeline corretamente.
 * 
 * NENHUM HOOK REGISTRADO - Frontend gerencia notificações.
 */
