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
 */

onRecordAfterUpdateRequest((e) => {
    // Desativado para evitar duplicação. O Frontend agora gerencia essas notificações.
    return;

    /* 
    // CÓDIGO LEGADO PARA REFERÊNCIA
    const collectionName = e.record.collection().name;
    
    if (collectionName === 'agenda_cap53_eventos') {
        // Lógica de transporte integrada...
    }

    if (collectionName === 'agenda_cap53_almac_requests') {
        // Lógica de almoxarifado...
    }
    */
});

onRecordAfterCreateRequest((e) => {
    // As notificações de criação também são gerenciadas pelo frontend (CreateEvent.tsx / ReRequestModal.tsx)
    // para garantir que o setor correto seja notificado com os dados precisos.
    return;
});
