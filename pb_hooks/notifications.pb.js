/// <reference path="../pb_data/types.d.ts" />

onRecordAfterUpdateRequest((e) => {
    const collectionName = e.record.collection().name;
    
    // ==================================================================================
    // 1. LÓGICA PARA EVENTOS (Transporte Integrado na Coleção de Eventos)
    // ==================================================================================
    if (collectionName === 'agenda_cap53_eventos') {
        // Obtém status BRUTO
        const rawStatus = e.record.getString('transporte_status');
        
        // Normalização agressiva: converte para string, minúsculas e remove espaços das pontas
        const status = rawStatus ? rawStatus.toString().toLowerCase().trim() : '';
        
        // Log de debug DETALHADO para diagnóstico (aparecerá nos logs do PocketBase)
        try {
            $app.logger().info(`[TRANSPORT_HOOK_DEBUG] Evento: ${e.record.id} | Raw: '${rawStatus}' | Clean: '${status}'`);
        } catch(ignore){}
        
        // Definição clara do tipo de decisão
        let isConfirmed = false;
        let isRejected = false;

        // Verificação flexível para garantir que 'confirmed' seja detectado
        if (status === 'confirmed' || status === 'approved' || status.includes('confirm')) {
            isConfirmed = true;
        } else if (status === 'rejected' || status === 'recusado' || status.includes('reject') || status.includes('recusa')) {
            isRejected = true;
        } else {
            // Se não for nem confirmado nem recusado (ex: pending), encerra.
            // Loga se for algo estranho que não seja vazio ou pending
            if (status && status !== 'pending') {
                $app.logger().warn(`[TRANSPORT_HOOK_WARN] Status ignorado/desconhecido: '${status}'`);
            }
            return;
        }

        const creatorId = e.record.getString('user');
        if (!creatorId) {
            $app.logger().error(`[TRANSPORT_HOOK_ERROR] Evento ${e.record.id} sem criador (user) definido.`);
            return;
        }

        try {
            const notificationsCol = $app.dao().findCollectionByNameOrId("agenda_cap53_notifications");
            const notification = new Record(notificationsCol);
            
            const eventTitle = e.record.getString('title');
            const justification = e.record.getString('transporte_justification');
            
            let title = '';
            let message = '';
            let icon = '';
            let color = '';
            let actionType = '';
            
            if (isConfirmed) {
                title = 'Transporte Confirmado';
                message = `Sua solicitação de transporte para o evento "${eventTitle}" foi confirmada!`;
                icon = 'check_circle';
                color = 'success';
                actionType = 'confirmed';
                
                try { $app.logger().info(`[TRANSPORT_HOOK_ACTION] Gerando notificação de ACEITE para evento ${e.record.id}`); } catch(i){}
            } else {
                title = 'Transporte Recusado';
                message = `Sua solicitação de transporte para o evento "${eventTitle}" foi recusada.`;
                if (justification) message += ` Motivo: ${justification}`;
                icon = 'cancel';
                color = 'error';
                actionType = 'rejected';
                
                try { $app.logger().info(`[TRANSPORT_HOOK_ACTION] Gerando notificação de RECUSA para evento ${e.record.id}`); } catch(i){}
            }

            notification.set("user", creatorId);
            notification.set("title", title);
            notification.set("message", message);
            notification.set("type", "transport_decision");
            notification.set("event", e.record.id);
            notification.set("read", false);
            // Salva o status limpo
            notification.set("invite_status", isConfirmed ? 'confirmed' : 'rejected');

            // Payload duplicado (data e meta) para garantir compatibilidade
            const payloadData = {
                action: actionType,
                kind: 'transport_decision',
                justification: justification,
                event_title: eventTitle,
                status: isConfirmed ? 'confirmed' : 'rejected',
                collection: 'agenda_cap53_eventos',
                icon: icon,
                color: color
            };

            // Tenta setar data (JSON) e meta (String) para garantir compatibilidade
            // Nota: O campo 'data' no PB pode ser JSON ou text dependendo da versão/schema.
            // O código original usava ambos.
            notification.set("data", payloadData); 
            notification.set("meta", JSON.stringify(payloadData));

            $app.dao().saveRecord(notification);
            
        } catch (err) {
            $app.logger().error(`[HOOK EVENTOS ERROR] Falha ao criar notificação: ${err}`);
        }
        return; // Encerra aqui para eventos
    }

    // ==================================================================================
    // 2. LÓGICA PARA REQUESTS (Almoxarifado, DCA, Transporte Legacy)
    // ==================================================================================
    let config = null;
    if (collectionName === 'agenda_cap53_almac_requests') {
        config = { decisionType: 'request_decision', role: 'ALMC', label: 'Almoxarifado/Copa' };
    } else if (collectionName === 'agenda_cap53_dca_requests') {
        config = { decisionType: 'request_decision', role: 'DCA', label: 'Informática' };
    } else if (collectionName === 'agenda_cap53_transporte_requests') {
        // Apenas processa requests legados se NÃO for evento (já tratado acima)
        config = { decisionType: 'transport_decision', role: 'TRA', label: 'Transporte' };
    }

    if (!config) return;

    try {
        // Tenta buscar o registro atualizado
        let record;
        try {
            record = $app.dao().findRecordById(collectionName, e.record.id);
        } catch(findErr) {
            record = e.record; // Fallback
        }
        
        const rawStatus = record.getString("status");
        // Normalização
        const status = rawStatus ? rawStatus.toString().toLowerCase().trim() : '';

        // Aceita 'confirmed' aqui também por segurança
        if (status === "approved" || status === "rejected" || status === "confirmed") {
            let creatorId = record.getString("created_by");
            if (!creatorId) creatorId = record.getString("user");
            
            if (!creatorId) {
                const eventId = record.getString("event");
                if (eventId) {
                    try {
                        const eventRecord = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
                        if (eventRecord) {
                            creatorId = eventRecord.getString("user");
                        }
                    } catch (evErr) {}
                }
            }

            if (creatorId) {
                try {
                    const notificationsCol = $app.dao().findCollectionByNameOrId("agenda_cap53_notifications");
                    const notification = new Record(notificationsCol);
                    
                    const isApproved = (status === 'approved' || status === 'confirmed');
                    const action = isApproved ? 'Aprovada' : 'Rejeitada';
                    const icon = isApproved ? 'check_circle' : 'cancel';
                    const color = isApproved ? 'success' : 'error';
                    
                    let quantity = record.getInt("quantity");
                    if (quantity === 0) {
                        try { quantity = record.getInt("passengers"); } catch (errPass) {}
                    }

                    // Tenta buscar nome do item
                    let itemName = "";
                    try {
                        const itemId = record.getString("item");
                        if (itemId) {
                            // Tenta buscar na coleção de itens (nome corrigido para itens_servico)
                            try {
                                const itemRecord = $app.dao().findRecordById("agenda_cap53_itens_servico", itemId);
                                if (itemRecord) itemName = itemRecord.getString("name");
                            } catch (err1) {
                                // Fallback para nome antigo se existir
                                const itemRecord = $app.dao().findRecordById("agenda_cap53_itens", itemId);
                                if (itemRecord) itemName = itemRecord.getString("name");
                            }
                        }
                    } catch (iErr) {}

                    let message = `Sua solicitação `;
                    if (itemName) {
                        message += `de ${itemName}`;
                    } else {
                        message += `para ${config.label}`;
                    }

                    if (quantity > 0) message += ` (Qtd: ${quantity})`;
                    message += ` foi ${isApproved ? 'aprovada' : 'rejeitada'}.`;
                    
                    if (status === 'rejected') {
                        const justification = record.getString("justification");
                        if (justification) message += ` Motivo: ${justification}`;
                    }

                    notification.set("user", creatorId);
                    
                    let title = "";
                    if (itemName) {
                        // Ex: "Microfone: Aprovada"
                        title = `${itemName}: ${action}`;
                    } else {
                        // Ex: "Solicitação Almoxarifado Aprovada"
                        title = `Solicitação ${config.label} ${action}`;
                    }
                    
                    notification.set("title", title);
                    notification.set("message", message);
                    notification.set("type", config.decisionType);
                    notification.set("read", false);
                    notification.set("related_request", record.id);
                    
                    const eventId = record.getString("event");
                    if (eventId) {
                        notification.set("related_event", eventId);
                        notification.set("event", eventId);
                    }

                    const payloadData = {
                        status: status,
                        collection: collectionName,
                        icon: icon,
                        color: color,
                        justification: record.getString("justification"),
                        action: isApproved ? 'approved' : 'rejected',
                        item_name: itemName,
                        quantity: quantity
                    };

                    notification.set("data", payloadData);
                    notification.set("meta", JSON.stringify(payloadData));

                    $app.dao().saveRecord(notification);
                } catch (err) {}
            }
        }
    } catch (err) {
        $app.logger().error(`[HOOK CRITICAL REQUESTS] ${err}`);
    }

}, "agenda_cap53_almac_requests", "agenda_cap53_dca_requests", "agenda_cap53_transporte_requests", "agenda_cap53_eventos");

// Hook de limpeza ao deletar eventos
onRecordBeforeDeleteRequest((e) => {
    const eventId = e.record.id;
    if (!eventId) return;

    try {
        const notifications = $app.dao().findRecordsByFilter(
            "agenda_cap53_notifications",
            `event = '${eventId}' || related_event = '${eventId}'`
        );

        for (const notification of notifications) {
            try { $app.dao().deleteRecord(notification); } catch (delErr) {}
        }
    } catch (err) {
        // Ignora erros de delete
    }
}, "agenda_cap53_eventos");
