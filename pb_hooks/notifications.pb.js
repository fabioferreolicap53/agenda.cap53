// 0. Teste de Carga do Hook
$app.logger().info("CRITICAL: notifications.pb.js is starting to load at " + new Date().toISOString());

// --- AUXILIARY FUNCTIONS ---

function createMissingNotificationsForRequest(app, request, event, log) {
    try {
        const itemId = request.getString('item');
        if (!itemId) return 0;

        const item = app.dao().findRecordById("agenda_cap53_itens_servico", itemId);
        
        // Normalize category check (case insensitive)
        const itemCategory = (item.getString('category') || '').toUpperCase();
        const targetRole = itemCategory === 'INFORMATICA' ? 'DCA' : 'ALMC';
        
        const sectorUsers = app.dao().findRecordsByFilter(
            "agenda_cap53_usuarios",
            `role = '${targetRole}'`
        );

        const eventTitle = event.getString('title') || 'Evento';
        const quantity = request.getInt('quantity') || 1;
        const eventId = event.id;

        let createdCount = 0;
        sectorUsers.forEach(u => {
            // Verifica se já existe uma notificação para este usuário e pedido
            try {
                const existing = app.dao().findFirstRecordByFilter(
                    "agenda_cap53_notifications",
                    `user = '${u.id}' && related_request = '${request.id}'`
                );
                if (existing) return; // Já existe
            } catch(e) {}

            const notifications = app.dao().findCollectionByNameOrId("agenda_cap53_notifications");
            const record = new Record(notifications);
            record.set("user", u.id);
            record.set("title", "Solicitação de Item");
            record.set("message", `O evento "${eventTitle}" solicitou o item "${item.getString("name")}" (Qtd: ${quantity}).`);
            record.set("type", "almc_item_request");
            record.set("read", false);
            record.set("event", eventId);
            record.set("related_request", request.id);
            record.set("invite_status", "pending");
            record.set("acknowledged", false);
            record.set("data", { 
                kind: "almc_item_request", 
                quantity: quantity, 
                item: itemId,
                event_title: eventTitle
            });
            app.dao().saveRecord(record);
            createdCount++;
        });
        if (log) log(`Created ${createdCount} missing notifications for item ${item.getString("name")} (Role: ${targetRole})`);
        return createdCount;
    } catch (err) {
        if (log) log(`Error creating missing notifications: ${err.message}`);
        return 0;
    }
}

// --- RECORD HOOKS ---

function handleAfterChange(e) {
    const collectionName = e.record.collection().name;
    
    // Log para depuração
    $app.logger().info(`[AFTER CHANGE] Collection: ${collectionName} ID: ${e.record.id}`);

    // --- ALMAC REQUESTS (ALMC / DCA) ---
    if (collectionName === 'agenda_cap53_almac_requests') {
        try {
            const eventId = e.record.getString('event');
            const event = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
            
            // 1. Create notifications for Approvers (if new request)
            createMissingNotificationsForRequest($app, e.record, event, (msg) => $app.logger().info(`[HOOK] ${msg}`));

            // 2. Notify Requester/Creator on Decision (Status Change)
            const status = e.record.getString('status');
            if (status === 'approved' || status === 'rejected') {
                const requestId = e.record.id;
                
                // Check if notification already exists for this decision
                let alreadyNotified = false;
                try {
                    const existing = $app.dao().findFirstRecordByFilter(
                        "agenda_cap53_notifications",
                        `related_request = '${requestId}' && data.action = '${status}'`
                    );
                    if (existing) alreadyNotified = true;
                } catch (_) {}

                if (!alreadyNotified) {
                    const itemId = e.record.getString('item');
                    if (!itemId) return; // Skip if no item
                    
                    const item = $app.dao().findRecordById("agenda_cap53_itens_servico", itemId);
                    const itemName = item.getString('name');
                    const quantity = e.record.getInt('quantity');
                    const justification = e.record.getString('justification');
                    
                    const eventTitle = event.getString('title') || 'Evento';
                    const eventCreatorId = event.getString('user');
                    const requesterId = e.record.getString('created_by');

                    // Determine who to notify: Requester and Event Creator
                    const usersToNotify = new Set();
                    if (requesterId) usersToNotify.add(requesterId);
                    if (eventCreatorId) usersToNotify.add(eventCreatorId);

                    const notifications = $app.dao().findCollectionByNameOrId("agenda_cap53_notifications");

                    usersToNotify.forEach(userId => {
                        try {
                            const record = new Record(notifications);
                            record.set("user", userId);
                            record.set("title", `Item ${status === 'approved' ? 'Aprovado' : 'Reprovado'}`);
                            
                            let message = `O pedido de "${itemName}" (Qtd: ${quantity}) para o evento "${eventTitle}" foi ${status === 'approved' ? 'aprovado' : 'reprovado'}.`;
                            if (status === 'rejected' && justification) {
                                message += ` Motivo: ${justification}`;
                            }
                            
                            record.set("message", message);
                            record.set("type", status === 'rejected' ? 'refusal' : 'system');
                            record.set("read", false);
                            record.set("event", eventId);
                            record.set("related_request", requestId);
                            record.set("data", {
                                kind: 'almc_item_decision',
                                action: status,
                                item_name: itemName,
                                event_title: eventTitle
                            });
                            
                            $app.dao().saveRecord(record);
                            $app.logger().info(`[HOOK] Notification sent to ${userId} regarding request ${requestId} (${status})`);
                        } catch (err) {
                            $app.logger().error(`[HOOK] Error notifying user ${userId}: ${err.message}`);
                        }
                    });
                }
            }
        } catch (notifErr) {
            $app.logger().error('Error in hook for almac_requests', notifErr);
        }
    }

    // --- EVENT CHANGES (TRANSPORTE - TRA) ---
    if (collectionName === 'agenda_cap53_eventos') {
        try {
            const isTransport = e.record.getBool('transporte_suporte');
            
            // Se transporte for solicitado
            if (isTransport) {
                const eventId = e.record.id;
                const eventTitle = e.record.getString('title') || 'Evento';
                
                // Verifica se já enviamos notificação de transporte para este evento
                // Evita duplicidade em updates
                let alreadyNotified = false;
                try {
                    const existing = $app.dao().findFirstRecordByFilter(
                        "agenda_cap53_notifications",
                        `event = '${eventId}' && type = 'transport_request'`
                    );
                    if (existing) alreadyNotified = true;
                } catch (_) {}

                if (!alreadyNotified) {
                    $app.logger().info(`[HOOK] Creating transport notifications for event ${eventId}`);
                    
                    // Busca usuários do setor de Transporte (TRA)
                    const traUsers = $app.dao().findRecordsByFilter("agenda_cap53_usuarios", "role = 'TRA'");
                    
                    const notifications = $app.dao().findCollectionByNameOrId("agenda_cap53_notifications");
                    
                    traUsers.forEach(u => {
                        try {
                            const record = new Record(notifications);
                            record.set("user", u.id);
                            record.set("title", "Solicitação de Transporte");
                            record.set("message", `O evento "${eventTitle}" solicitou apoio de transporte.`);
                            record.set("type", "transport_request");
                            record.set("read", false);
                            record.set("event", eventId);
                            record.set("invite_status", "pending");
                            record.set("acknowledged", false);
                            record.set("data", { 
                                kind: "transport_request",
                                event_title: eventTitle,
                                origem: e.record.getString('transporte_origem'),
                                destino: e.record.getString('transporte_destino'),
                                horario_levar: e.record.getString('transporte_horario_levar'),
                                horario_buscar: e.record.getString('transporte_horario_buscar')
                            });
                            $app.dao().saveRecord(record);
                            $app.logger().info(`[HOOK] Transport notification sent to ${u.id}`);
                        } catch (err) {
                            $app.logger().error(`[HOOK] Error creating transport notification for ${u.id}: ${err.message}`);
                        }
                    });
                }
            }
        } catch (err) {
            $app.logger().error(`[HOOK] Error processing event transport logic: ${err.message}`);
        }
    }
}

$app.onRecordAfterCreateRequest().add((e) => {
    $app.logger().info("[HOOK] onRecordAfterCreateRequest triggered");
    try {
        handleAfterChange(e);
    } catch (err) {
        $app.logger().error("[HOOK ERROR] onRecordAfterCreateRequest: " + err.message);
    }
});

$app.onRecordAfterUpdateRequest().add((e) => {
    $app.logger().info("[HOOK] onRecordAfterUpdateRequest triggered");
    try {
        handleAfterChange(e);
    } catch (err) {
        $app.logger().error("[HOOK ERROR] onRecordAfterUpdateRequest: " + err.message);
    }
});

// --- HOOK DE EXCLUSÃO DE EVENTO ---
// Garante que ao excluir um evento, todas as dependências sejam removidas
$app.onRecordBeforeDeleteRequest("agenda_cap53_eventos").add((e) => {
    $app.logger().info("[DELETE HOOK] Hook disparado para evento: " + e.record.id);
    
    const app = $app;
    const eventId = e.record.id;

    // Helper function to safely delete related records
    const deleteRelated = (collectionName, filter) => {
        try {
            // Check if collection exists implicitly by trying to find records
            const records = app.dao().findRecordsByFilter(collectionName, filter);
            if (records.length > 0) {
                records.forEach(r => app.dao().deleteRecord(r));
                app.logger().info(`[DELETE HOOK] Deleted ${records.length} records from ${collectionName}`);
            }
        } catch (err) {
            // Log warning but don't stop execution
            app.logger().warn(`[DELETE HOOK WARN] Failed to delete from ${collectionName}: ${err.message}`);
        }
    };

    try {
        // 1. Chat System
        // Delete messages first (via rooms), then rooms
        try {
            const rooms = app.dao().findRecordsByFilter("agenda_cap53_salas_batepapo", `event = '${eventId}'`);
            rooms.forEach(room => {
                deleteRelated("agenda_cap53_mensagens_salas", `room = '${room.id}'`);
                app.dao().deleteRecord(room);
            });
            if (rooms.length > 0) app.logger().info(`[DELETE HOOK] Deleted ${rooms.length} chat rooms`);
        } catch (err) {
            app.logger().warn(`[DELETE HOOK WARN] Failed to process chat rooms: ${err.message}`);
        }

        // 2. Notifications (prioritize this as they might reference other things)
        deleteRelated("agenda_cap53_notifications", `event = '${eventId}'`);

        // 3. Requests (Almac/Informatica)
        deleteRelated("agenda_cap53_almac_requests", `event = '${eventId}'`);

        // 4. Participants
        deleteRelated("agenda_cap53_participantes", `event = '${eventId}'`);
        
        // 5. Event Solicitations (Misc)
        deleteRelated("agenda_cap53_solicitacoes_evento", `event = '${eventId}'`);

    } catch (mainErr) {
        // Log critical error but try to proceed to let DB handle it if possible
        app.logger().error("[DELETE HOOK CRITICAL] " + mainErr.message);
    }

    return;
});

// --- ROUTES (REGISTRADAS NO onBeforeServe) ---

$app.onBeforeServe().add((e) => {
    $app.logger().info("[onBeforeServe] Registrando rotas...");

    // 1. Endpoint para Sincronização Forçada de Notificações de Evento
    e.router.add('POST', '/api/sync_event_notifications', (c) => {
        $app.logger().info("[ENDPOINT] /api/sync_event_notifications called");
        
        const data = $apis.requestInfo(c).data;
        const eventId = data.event_id;

        if (!eventId) throw new BadRequestError("Missing event_id");

        const logs = [];
        const log = (msg) => {
            $app.logger().info(msg);
            logs.push(msg);
        };

        try {
            log(`Starting sync for event ${eventId}`);
            const event = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
            const eventTitle = event.getString("title");

            const requests = $app.dao().findRecordsByFilter("agenda_cap53_almac_requests", `event = '${eventId}'`);
            let notifications = $app.dao().findRecordsByFilter("agenda_cap53_notifications", `event = '${eventId}' && (type = 'almc_item_request' || type = 'service_request')`);

            let updatedCount = 0;
            let createdCount = 0;
            const notifsByRequest = {};

            notifications.forEach(n => {
                const reqId = n.getString("related_request");
                if (reqId) {
                    if (!notifsByRequest[reqId]) notifsByRequest[reqId] = [];
                    notifsByRequest[reqId].push(n);
                }
            });

            requests.forEach(req => {
                let targetNotifs = notifsByRequest[req.id] || [];
                if (targetNotifs.length > 0) {
                    targetNotifs.forEach(notif => {
                        notif.set("message", `O evento "${eventTitle}" solicitou o item (Qtd: ${req.getInt("quantity")}).`);
                        $app.dao().saveRecord(notif);
                        updatedCount++;
                    });
                } else {
                    createdCount += createMissingNotificationsForRequest($app, req, event, log);
                }
            });

            return c.json(200, { success: true, updated: updatedCount, created: createdCount, logs: logs });
        } catch (err) {
            return c.json(500, { error: err.message });
        }
    }, $apis.requireRecordAuth());

    // 2. Decisão de Transporte
    e.router.add('POST', '/api/transport_decision', (c) => {
        const data = $apis.requestInfo(c).data;
        const eventId = data.event_id;
        const status = data.status;
        const justification = data.justification || 'Ação realizada pelo setor de transporte.';

        if (!eventId || !status) return c.json(400, { message: 'Missing event_id or status' });

        try {
            const event = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
            event.set("transporte_status", status);
            event.set('transporte_justification', justification);
            $app.dao().saveRecord(event);

            const creatorId = event.getString('user');
            if (creatorId) {
                const notifications = $app.dao().findCollectionByNameOrId('agenda_cap53_notifications');
                const record = new Record(notifications);
                const eventTitle = event.getString('title') || 'Evento';

                record.set('user', creatorId);
                record.set('read', false);
                record.set('event', eventId);
                record.set('type', status === 'rejected' ? 'refusal' : 'acknowledgment');
                record.set('title', status === 'rejected' ? 'Transporte Recusado' : 'Transporte Confirmado');
                record.set('message', `A solicitação de transporte para o evento "${eventTitle}" ${status === 'rejected' ? 'foi recusada' : 'foi confirmada'}.\n\nJustificativa: ${justification}`);
                record.set('data', { kind: 'transport_decision', action: status, justification: justification });

                $app.dao().saveRecord(record);
            }

            return c.json(200, { success: true });
        } catch (err) {
            return c.json(500, { error: err.message });
        }
    }, $apis.requireRecordAuth());

    // 3. Resposta de Convite / Participação
    e.router.add('POST', '/api/respond_invite', (c) => {
        const data = $apis.requestInfo(c).data;
        const notifId = data.notification_id;
        const action = data.action;
        const authRecord = c.get('authRecord');

        if (!notifId || !action) return c.json(400, { message: 'Missing params' });

        try {
            const notif = $app.dao().findRecordById("agenda_cap53_notifications", notifId);
            if (notif.getString("user") !== authRecord.id) return c.json(403, { message: "Access denied" });

            notif.set("invite_status", action === 'accepted' ? 'accepted' : 'rejected');
            notif.set("read", true);
            $app.dao().saveRecord(notif);

            const eventId = notif.getString("event");
            if (eventId && (notif.getString("type") === 'event_invite' || notif.getString("type") === 'event_participation_request')) {
                try {
                    const participant = $app.dao().findFirstRecordByFilter("agenda_cap53_participantes", `event = '${eventId}' && user = '${authRecord.id}'`);
                    participant.set("status", action === 'accepted' ? 'accepted' : 'rejected');
                    $app.dao().saveRecord(participant);
                } catch (e) {
                    const collection = $app.dao().findCollectionByNameOrId("agenda_cap53_participantes");
                    const participant = new Record(collection);
                    participant.set("event", eventId);
                    participant.set("user", authRecord.id);
                    participant.set("status", action === 'accepted' ? 'accepted' : 'rejected');
                    $app.dao().saveRecord(participant);
                }
            }
            return c.json(200, { success: true });
        } catch (err) {
            return c.json(500, { error: err.message });
        }
    }, $apis.requireRecordAuth());

    // 4. Ciência de Recusa (Acknowledge)
    e.router.add("POST", "/api/acknowledge_refusal", (c) => {
        const data = $apis.requestInfo(c).data;
        const notifId = data.notification_id;
        const authRecord = c.get("authRecord");

        try {
            const notif = $app.dao().findRecordById("agenda_cap53_notifications", notifId);
            if (notif.getString("user") !== authRecord.id) return c.json(403, { message: "Access denied" });

            notif.set("acknowledged", true);
            notif.set("read", true);
            $app.dao().saveRecord(notif);

            return c.json(200, { success: true });
        } catch (err) {
            return c.json(500, { error: err.message });
        }
    }, $apis.requireRecordAuth());

    // 5. Saúde do Hook
    e.router.add("GET", "/api/hooks_health", (c) => {
        return c.json(200, { status: "ok", message: "Hooks ativos no onBeforeServe!" });
    });
});