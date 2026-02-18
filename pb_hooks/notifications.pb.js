onRecordAfterUpdateRequest((e) => {
    const collectionName = e.record.collection().name;
    
    // Configuração para cada coleção
    let config = null;
    if (collectionName === 'agenda_cap53_almac_requests') {
        config = { decisionType: 'request_decision', role: 'ALMC', label: 'Almoxarifado/Copa' };
    } else if (collectionName === 'agenda_cap53_dca_requests') {
        config = { decisionType: 'request_decision', role: 'DCA', label: 'Informática' };
    } else if (collectionName === 'agenda_cap53_transporte_requests') {
        config = { decisionType: 'transport_decision', role: 'TRA', label: 'Transporte' };
    }

    if (!config) return;

    try {
        const record = $app.dao().findRecordById(collectionName, e.record.id);
        const status = record.getString("status");

        if (status === "approved" || status === "rejected") {
            // 1. Tenta pegar o ID do criador direto na solicitação
            let creatorId = record.getString("created_by");
            if (!creatorId) creatorId = record.getString("user");
            
            // 2. Fallback: busca no EVENTO relacionado
            if (!creatorId) {
                const eventId = record.getString("event");
                if (eventId) {
                    try {
                        const eventRecord = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
                        if (eventRecord) {
                            creatorId = eventRecord.getString("user");
                        }
                    } catch (evErr) {
                        // Silencioso em produção
                    }
                }
            }

            if (creatorId) {
                try {
                    const notificationsCol = $app.dao().findCollectionByNameOrId("agenda_cap53_notifications");
                    const notification = new Record(notificationsCol);
                    
                    const action = status === 'approved' ? 'Aprovada' : 'Rejeitada';
                    const icon = status === 'approved' ? 'check_circle' : 'cancel';
                    const color = status === 'approved' ? 'success' : 'error';
                    
                    // Tenta obter a quantidade (quantity ou passengers)
                    // Se não existir, retorna 0 (valor default)
                    let quantity = record.getInt("quantity");
                    if (quantity === 0) {
                        // Tenta ler passengers apenas se quantity for 0, caso exista na coleção
                        try {
                            quantity = record.getInt("passengers");
                        } catch (errPass) {
                            // Ignora erro se o campo não existir
                        }
                    }

                    // Monta a mensagem
                    let message = `Sua solicitação para ${config.label}`;
                    
                    if (quantity > 0) {
                        message += ` (Qtd: ${quantity})`;
                    }
                    
                    message += ` foi ${status === 'approved' ? 'aprovada' : 'rejeitada'}.`;
                    
                    if (status === 'rejected') {
                        const justification = record.getString("justification");
                        if (justification) {
                            message += ` Motivo: ${justification}`;
                        }
                    }

                    notification.set("user", creatorId);
                    notification.set("title", `Solicitação ${config.label} ${action}`);
                    notification.set("message", message);
                    notification.set("type", config.decisionType);
                    notification.set("read", false);
                    notification.set("related_request", record.id);
                    
                    const eventId = record.getString("event");
                    if (eventId) notification.set("related_event", eventId);

                    notification.set("meta", JSON.stringify({
                        status: status,
                        collection: collectionName,
                        icon: icon,
                        color: color
                    }));

                    $app.dao().saveRecord(notification);
                } catch (err) {
                    console.log(`[HOOK ERROR] Failed to create notification: ${err}`);
                }
            }
        }
    } catch (err) {
        console.log(`[HOOK CRITICAL] ${err}`);
    }

}, "agenda_cap53_almac_requests", "agenda_cap53_dca_requests", "agenda_cap53_transporte_requests");

onRecordBeforeDeleteRequest((e) => {
    const eventId = e.record.id;
    
    try {
        // Delete all notifications related to this event
        const notifications = $app.dao().findRecordsByFilter(
            "agenda_cap53_notifications", 
            `event = '${eventId}' || related_event = '${eventId}'`
        );

        for (const notification of notifications) {
            $app.dao().deleteRecord(notification);
        }
    } catch (err) {
        // Log error but allow event deletion to proceed
        console.log(`[HOOK ERROR] Failed to delete notifications for event ${eventId}: ${err}`);
    }
}, "agenda_cap53_eventos");
