/// <reference path="../pb_data/types.d.ts" />

// 0. Teste de Carga do Hook
$app.logger().info("Hook notifications.pb.js is being loaded...");

$app.onBeforeServe((e) => {
    // Health Check Endpoint - MUST BE FIRST
    e.router.add('GET', '/api/hooks_health', (c) => {
        return c.json(200, { 
            status: 'ok', 
            message: 'Hooks are loaded and running', 
            time: new Date().toISOString(),
            version: '1.2'
        });
    });
});

// 0. Regras de concorrência: bloquear mudanças após decisão (exceto ADMIN)
$app.onRecordBeforeUpdateRequest((e) => {
    const oldStatus = e.original ? e.original.getString('status') : '';
    const newStatus = e.record.getString('status');

    if (oldStatus && oldStatus !== 'pending') {
        let role = '';
        try {
            if (e.httpContext) {
                const authRecord = e.httpContext.get('authRecord');
                role = authRecord ? authRecord.getString('role') : '';
            }
        } catch (err) {}

        if (role !== 'ADMIN') {
            if (newStatus !== oldStatus) {
                throw new ForbiddenError('Solicitação já foi decidida e não pode ser alterada.');
            }
        }
    }
}, 'agenda_cap53_almac_requests');

$app.onRecordBeforeUpdateRequest((e) => {
    const oldStatus = e.original ? e.original.getString('transporte_status') : '';
    const newStatus = e.record.getString('transporte_status');

    if (oldStatus && oldStatus !== 'pending') {
        let role = '';
        try {
            if (e.httpContext) {
                const authRecord = e.httpContext.get('authRecord');
                role = authRecord ? authRecord.getString('role') : '';
            }
        } catch (err) {}

        if (role !== 'ADMIN') {
            if (newStatus !== oldStatus) {
                throw new ForbiddenError('Solicitação de transporte já foi decidida e não pode ser alterada.');
            }
        }
    }
}, 'agenda_cap53_eventos');

// 1. Trigger para detecção de Recusa de Item (ALMC)
$app.onRecordAfterUpdateRequest((e) => {
    const newStatus = e.record.getString('status');
    const oldStatus = e.original ? e.original.getString('status') : '';

    if (newStatus === 'rejected' && oldStatus !== 'rejected') {
        const createdBy = e.record.getString('created_by');
        let rejectedById = "";
        let rejectedByName = "ALMC";
        
        try {
            if (e.httpContext) {
                const authRecord = e.httpContext.get("authRecord");
                if (authRecord) {
                    rejectedById = authRecord.id;
                    rejectedByName = authRecord.getString("name") || authRecord.getString("email");
                }
            }
        } catch (err) {
            $app.logger().warn("Notification Hook: No HTTP context for refusal", err);
        }

        if (createdBy && createdBy !== rejectedById) {
            try {
                const notifications = $app.dao().findCollectionByNameOrId("agenda_cap53_notifications");
                const record = new Record(notifications);
                
                const justification = e.record.getString("justification") || "Sem justificativa";

                record.set("user", createdBy);
                record.set("title", "Solicitação Reprovada");
                record.set("message", `Sua solicitação foi reprovada. Justificativa: ${justification}`);
                record.set("type", "refusal");
                record.set("read", false);
                record.set("related_request", e.record.id);
                record.set("event", e.record.getString("event"));
                record.set("data", { 
                    kind: "almc_item",
                    rejected_by: rejectedById, 
                    rejected_by_name: rejectedByName,
                    refused_at: new Date().toISOString()
                });
                record.set("acknowledged", false);

                $app.dao().saveRecord(record);
            } catch (err) {
                $app.logger().error("Failed to create refusal notification", err);
            }
        }
    }
}, "agenda_cap53_almac_requests");


// 1.1 Trigger para detecção de Decisão de Transporte (TRA)
$app.onRecordAfterUpdateRequest((e) => {
    const newStatus = e.record.getString('transporte_status');
    const oldStatus = e.original ? e.original.getString('transporte_status') : '';

    // Log the update for debugging
    $app.logger().info(`Transport Decision Hook Triggered: ID=${e.record.id}, old=${oldStatus}, new=${newStatus}`);

    // ONLY proceed if we have httpContext (Admin UI or direct API update)
    // Updates from custom routes (like /api/transport_decision) are handled directly in the route handler
    if (!e.httpContext) {
        return;
    }

    if ((newStatus === 'rejected' || newStatus === 'confirmed') && newStatus !== oldStatus) {
        const creatorId = e.record.getString('user');
        if (!creatorId) {
            $app.logger().warn(`Transport Decision Hook: No creator ID for event ${e.record.id}`);
            return;
        }

        let deciderById = '';
        let deciderByName = 'Setor de Transporte';

        try {
            if (e.httpContext) {
                const authRecord = e.httpContext.get('authRecord');
                if (authRecord) {
                    deciderById = authRecord.id;
                    deciderByName = authRecord.getString('name') || authRecord.getString('email');
                }
            }
        } catch (err) {
            $app.logger().warn('Notification Hook: No HTTP context for transport decision', err);
        }

        if (creatorId) {
            try {
                const notifications = $app.dao().findCollectionByNameOrId('agenda_cap53_notifications');
                const record = new Record(notifications);

                const eventTitle = e.record.getString('title') || 'Evento';

                record.set('user', creatorId);
                record.set('read', false);
                record.set('event', e.record.id);
                record.set('acknowledged', false);

                if (newStatus === 'rejected') {
                    const justification = e.record.getString('transporte_justification') || 'Sem justificativa fornecida.';
                    record.set('title', 'Transporte Recusado');
                    record.set('message', `A solicitação de transporte para o evento "${eventTitle}" foi recusada.\n\nJustificativa: ${justification}`);
                    record.set('type', 'refusal');
                    record.set('data', {
                        kind: 'transport_decision',
                        action: 'rejected',
                        rejected_by: deciderById,
                        rejected_by_name: deciderByName,
                        justification: justification,
                        refused_at: new Date().toISOString(),
                    });
                } else {
                    const justification = e.record.getString('transporte_justification');
                    record.set('title', 'Transporte Confirmado');
                    let message = `A solicitação de transporte para o evento "${eventTitle}" foi confirmada.`;
                    if (justification) {
                        message += `\n\nObservação: ${justification}`;
                    }
                    record.set('message', message);
                    record.set('type', 'system');
                    record.set('data', {
                        kind: 'transport_decision',
                        action: 'confirmed',
                        confirmed_by: deciderById,
                        confirmed_by_name: deciderByName,
                        justification: justification || '',
                        confirmed_at: new Date().toISOString(),
                    });
                }

                $app.dao().saveRecord(record);
                $app.logger().info(`Transport Decision Notification Created: status=${newStatus}, event=${e.record.id}, to_user=${creatorId}`);
            } catch (err) {
                $app.logger().error('Failed to create transport decision notification', err);
            }
        }
    }
}, 'agenda_cap53_eventos');


// --- ENDPOINTS (API CUSTOM ROUTES) ---
$app.onBeforeServe((e) => {
    // 2. Endpoint para Responder Convite de Evento (NEW RELATIONAL SYSTEM)
    e.router.add("POST", "/api/respond_invite", (c) => {
        const data = $apis.requestInfo(c).data;
        const notificationId = data.notification_id;
        const action = data.action; // 'accepted' | 'rejected'
        const authRecord = c.get("authRecord");

        if (!notificationId || !action) {
            throw new BadRequestError("Missing notification_id or action");
        }

        try {
            // 1. Update Notification
            const notification = $app.dao().findRecordById("agenda_cap53_notifications", notificationId);
            
            if (notification.getString("user") !== authRecord.id) {
                throw new ForbiddenError("You can only respond to your own notifications");
            }

            notification.set("invite_status", action);
            notification.set("read", true);
            $app.dao().saveRecord(notification);

            // 2. Update Relational Participant Status (NEW SYSTEM)
            const eventId = notification.getString("event");
            if (eventId) {
                try {
                    // Find or Create the participant record in the new collection
                    let participantRecord;
                    try {
                        participantRecord = $app.dao().findFirstRecordByFilter(
                            "agenda_cap53_participantes",
                            `event = "${eventId}" && user = "${authRecord.id}"`
                        );
                    } catch (e) {
                        // Create if doesn't exist (safety for old events)
                        const collection = $app.dao().findCollectionByNameOrId("agenda_cap53_participantes");
                        participantRecord = new Record(collection);
                        participantRecord.set("event", eventId);
                        participantRecord.set("user", authRecord.id);
                    }

                    participantRecord.set("status", action === 'accepted' ? 'accepted' : 'rejected');
                    $app.dao().saveRecord(participantRecord);
                    
                    // BACKWARD COMPATIBILITY: Update the JSON field in event too
                    const event = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
                    let current = event.get("participants_status");
                    if (!current) current = {};
                    if (typeof current === 'string') {
                        try { current = JSON.parse(current); } catch(e) { current = {} }
                    }
                    const newMap = JSON.parse(JSON.stringify(current));
                    newMap[authRecord.id] = action;
                    event.set("participants_status", newMap);
                    $app.dao().saveRecord(event);

                    $app.logger().info(`Relational sync complete: Event ${eventId}, User ${authRecord.id} -> ${action}`);
                } catch (syncErr) {
                    $app.logger().error("Relational sync failed", syncErr);
                }
            }

            return c.json(200, { success: true });
        } catch (err) {
            $app.logger().error("Error in respond_invite", err);
            throw new BadRequestError("Failed to respond to invite: " + err.message);
        }
    }, $apis.requireRecordAuth());

    // 5. Endpoint para Decisão de Transporte (TRA) - Bypass API Rules
    e.router.add('POST', '/api/transport_decision', (c) => {
        const data = $apis.requestInfo(c).data;
        const eventId = data.event_id;
        const status = data.status; // 'confirmed' | 'rejected'
        const justification = data.justification || '';
        const authRecord = c.get('authRecord');

        if (!eventId || !status) {
            $app.logger().warn(`Transport Decision API: Missing parameters. eventId=${eventId}, status=${status}`);
            throw new BadRequestError('Missing event_id or status');
        }
        
        if (authRecord.getString('role') !== 'TRA' && authRecord.getString('role') !== 'ADMIN') {
            $app.logger().warn(`Transport Decision API: Forbidden access by user ${authRecord.id} with role ${authRecord.getString('role')}`);
            throw new ForbiddenError('Only TRA or ADMIN users can make transport decisions');
        }

        try {
            $app.logger().info(`Transport Decision API Attempt: Event=${eventId}, Status=${status}, User=${authRecord.id}`);
            const event = $app.dao().findRecordById('agenda_cap53_eventos', eventId);
            
            const oldStatus = event.getString('transporte_status');
            event.set('transporte_status', status);
            event.set('transporte_justification', justification);
            
            $app.dao().saveRecord(event);
            
            $app.logger().info(`Transport Decision via API: Event=${eventId}, Status=${status}, by=${authRecord.id}`);

            // CREATE NOTIFICATION DIRECTLY HERE to ensure decider info is captured
            // (Hooks might not have access to httpContext when triggered from dao.saveRecord in a custom route)
            const creatorId = event.getString('user');
            if (creatorId && status !== oldStatus) {
                try {
                    const notifications = $app.dao().findCollectionByNameOrId('agenda_cap53_notifications');
                    const record = new Record(notifications);
                    const eventTitle = event.getString('title') || 'Evento';
                    const deciderByName = authRecord.getString('name') || authRecord.getString('email');

                    record.set('user', creatorId);
                    record.set('read', false);
                    record.set('event', event.id);
                    record.set('acknowledged', false);

                    if (status === 'rejected') {
                        record.set('title', 'Transporte Recusado');
                        record.set('message', `A solicitação de transporte para o evento "${eventTitle}" foi recusada.\n\nJustificativa: ${justification || 'Sem justificativa fornecida.'}`);
                        record.set('type', 'refusal');
                        record.set('data', {
                            kind: 'transport_decision',
                            action: 'rejected',
                            rejected_by: authRecord.id,
                            rejected_by_name: deciderByName,
                            justification: justification,
                            refused_at: new Date().toISOString(),
                        });
                    } else {
                        record.set('title', 'Transporte Confirmado');
                        let message = `A solicitação de transporte para o evento "${eventTitle}" foi confirmada.`;
                        if (justification) {
                            message += `\n\nObservação: ${justification}`;
                        }
                        record.set('message', message);
                        record.set('type', 'system');
                        record.set('data', {
                            kind: 'transport_decision',
                            action: 'confirmed',
                            confirmed_by: authRecord.id,
                            confirmed_by_name: deciderByName,
                            justification: justification || '',
                            confirmed_at: new Date().toISOString(),
                        });
                    }

                    $app.dao().saveRecord(record);
                    $app.logger().info(`Transport Decision Notification Created (via API): status=${status}, event=${event.id}, to_user=${creatorId}`);
                } catch (notifErr) {
                    $app.logger().error('Failed to create notification in transport_decision API', notifErr);
                }
            }

            return c.json(200, { success: true });
        } catch (err) {
            $app.logger().error('Error in transport_decision API', err);
            throw new BadRequestError(err.message);
        }
    }, $apis.requireRecordAuth());

    // 3. Endpoint para Ciência de Recusa (ALMC)
    e.router.add("POST", "/api/acknowledge_refusal", (c) => {
        const data = $apis.requestInfo(c).data;
        const notificationId = data.notification_id;
        const authRecord = c.get("authRecord");

        if (!notificationId) throw new BadRequestError("Missing notification_id");

        try {
            const notification = $app.dao().findRecordById("agenda_cap53_notifications", notificationId);
            
            if (notification.getString("user") !== authRecord.id) {
                throw new ForbiddenError("Access denied");
            }

            if (notification.getBool("acknowledged")) {
                return c.json(200, { success: true, message: "Already acknowledged" });
            }

            notification.set("acknowledged", true);
            notification.set("read", true);
            $app.dao().saveRecord(notification);

            const notifData = notification.get("data");
            const rejectedById = notifData ? notifData["rejected_by"] : null;
            
            if (rejectedById) {
                const notifications = $app.dao().findCollectionByNameOrId("agenda_cap53_notifications");
                const newNotif = new Record(notifications);
                
                let itemName = "Item";
                try {
                     if (notification.getString("related_request")) {
                         const req = $app.dao().findRecordById("agenda_cap53_almac_requests", notification.getString("related_request"));
                         const itemId = req.getString("item");
                         if (itemId) {
                             const item = $app.dao().findRecordById("agenda_cap53_itens_servico", itemId);
                             itemName = item.getString("name");
                         }
                     }
                } catch(e) {}

                const creatorName = authRecord.getString("name") || authRecord.getString("email");

                newNotif.set("user", rejectedById);
                newNotif.set("title", "Ciência de Recusa");
                newNotif.set("message", `O criador ${creatorName} confirmou ciência da recusa do item "${itemName}".`);
                newNotif.set("type", "acknowledgment");
                newNotif.set("read", false);
                newNotif.set("related_request", notification.getString("related_request"));
                newNotif.set("event", notification.getString("event"));
                newNotif.set("data", {
                    original_refusal_id: notification.id,
                    creator_name: creatorName,
                    acknowledged_at: new Date().toISOString()
                });

                $app.dao().saveRecord(newNotif);
            }

            return c.json(200, { success: true });
        } catch (err) {
            $app.logger().error("Error in acknowledge_refusal", err);
            throw new BadRequestError(err.message);
        }
    }, $apis.requireRecordAuth());

    // 5. Endpoint para Decisão de Transporte (TRA) - Bypass API Rules
    e.router.add('POST', '/api/transport_decision', (c) => {
        const data = $apis.requestInfo(c).data;
        const eventId = data.event_id;
        const status = data.status; // 'confirmed' | 'rejected'
        const justification = data.justification || '';
        const authRecord = c.get('authRecord');

        if (!eventId || !status) {
            $app.logger().warn(`Transport Decision API: Missing parameters. eventId=${eventId}, status=${status}`);
            throw new BadRequestError('Missing event_id or status');
        }
        
        if (authRecord.getString('role') !== 'TRA' && authRecord.getString('role') !== 'ADMIN') {
            $app.logger().warn(`Transport Decision API: Forbidden access by user ${authRecord.id} with role ${authRecord.getString('role')}`);
            throw new ForbiddenError('Only TRA or ADMIN users can make transport decisions');
        }

        try {
            $app.logger().info(`Transport Decision API Attempt: Event=${eventId}, Status=${status}, User=${authRecord.id}`);
            const event = $app.dao().findRecordById('agenda_cap53_eventos', eventId);
            
            const oldStatus = event.getString('transporte_status');
            event.set('transporte_status', status);
            event.set('transporte_justification', justification);
            
            $app.dao().saveRecord(event);
            
            $app.logger().info(`Transport Decision via API: Event=${eventId}, Status=${status}, by=${authRecord.id}`);

            // CREATE NOTIFICATION DIRECTLY HERE to ensure decider info is captured
            // (Hooks might not have access to httpContext when triggered from dao.saveRecord in a custom route)
            const creatorId = event.getString('user');
            if (creatorId && status !== oldStatus) {
                try {
                    const notifications = $app.dao().findCollectionByNameOrId('agenda_cap53_notifications');
                    const record = new Record(notifications);
                    const eventTitle = event.getString('title') || 'Evento';
                    const deciderByName = authRecord.getString('name') || authRecord.getString('email');

                    record.set('user', creatorId);
                    record.set('read', false);
                    record.set('event', event.id);
                    record.set('acknowledged', false);

                    if (status === 'rejected') {
                        record.set('title', 'Transporte Recusado');
                        record.set('message', `A solicitação de transporte para o evento "${eventTitle}" foi recusada.\n\nJustificativa: ${justification || 'Sem justificativa fornecida.'}`);
                        record.set('type', 'refusal');
                        record.set('data', {
                            kind: 'transport_decision',
                            action: 'rejected',
                            rejected_by: authRecord.id,
                            rejected_by_name: deciderByName,
                            justification: justification,
                            refused_at: new Date().toISOString(),
                        });
                    } else {
                        record.set('title', 'Transporte Confirmado');
                        let message = `A solicitação de transporte para o evento "${eventTitle}" foi confirmada.`;
                        if (justification) {
                            message += `\n\nObservação: ${justification}`;
                        }
                        record.set('message', message);
                        record.set('type', 'system');
                        record.set('data', {
                            kind: 'transport_decision',
                            action: 'confirmed',
                            confirmed_by: authRecord.id,
                            confirmed_by_name: deciderByName,
                            justification: justification || '',
                            confirmed_at: new Date().toISOString(),
                        });
                    }

                    $app.dao().saveRecord(record);
                    $app.logger().info(`Transport Decision Notification Created (via API): status=${status}, event=${event.id}, to_user=${creatorId}`);
                } catch (notifErr) {
                    $app.logger().error('Failed to create notification in transport_decision API', notifErr);
                }
            }

            return c.json(200, { success: true });
        } catch (err) {
            $app.logger().error('Error in transport_decision API', err);
            throw new BadRequestError(err.message);
        }
    }, $apis.requireRecordAuth());

    // 6. Endpoint para Decisão de Item Almac/DCA
    e.router.add('POST', '/api/almac_decision', (c) => {
        const data = $apis.requestInfo(c).data;
        const requestId = data.request_id;
        const action = data.action; // 'approved' | 'rejected'
        const justification = data.justification || '';
        const authRecord = c.get('authRecord');

        if (!requestId || !action) {
            throw new BadRequestError('Missing request_id or action');
        }

        const role = authRecord.getString('role');
        if (role !== 'ALMC' && role !== 'DCA' && role !== 'ADMIN') {
            throw new ForbiddenError('Only ALMC, DCA or ADMIN users can make item decisions');
        }

        try {
            const request = $app.dao().findRecordById('agenda_cap53_almac_requests', requestId);
            
            // Check if user has permission for this specific item category
            $app.dao().expandRecord(request, ['item'], null);
            const item = request.expandedOne('item');
            if (item) {
                const category = item.getString('category');
                if (role === 'DCA' && category !== 'INFORMATICA') {
                    throw new ForbiddenError('DCA can only decide on INFORMATICA items');
                }
                if (role === 'ALMC' && (category !== 'ALMOXARIFADO' && category !== 'COPA')) {
                    throw new ForbiddenError('ALMC can only decide on ALMOXARIFADO or COPA items');
                }
            }

            const oldStatus = request.getString('status');
            if (oldStatus !== 'pending' && role !== 'ADMIN') {
                throw new BadRequestError('This request has already been decided');
            }

            request.set('status', action);
            request.set('justification', justification);
            request.set('decided_by', authRecord.id);
            request.set('decided_at', new Date().toISOString());
            
            $app.dao().saveRecord(request);

            // Notify requester
            const creatorId = request.getString('created_by');
            if (creatorId) {
                try {
                    const notifications = $app.dao().findCollectionByNameOrId('agenda_cap53_notifications');
                    const record = new Record(notifications);
                    const itemName = item ? item.getString('name') : 'Item';
                    const deciderByName = authRecord.getString('name') || authRecord.getString('email');

                    record.set('user', creatorId);
                    record.set('title', action === 'approved' ? 'Item Aprovado' : 'Item Recusado');
                    record.set('message', `Sua solicitação do item "${itemName}" foi ${action === 'approved' ? 'aprovada' : 'recusada'}.${justification ? ' Motivo: ' + justification : ''}`);
                    record.set('type', action === 'approved' ? 'system' : 'refusal');
                    record.set('read', false);
                    record.set('related_request', request.id);
                    record.set('event', request.getString('event'));
                    record.set('data', {
                        kind: 'almc_item_decision',
                        action: action,
                        decided_by: authRecord.id,
                        decided_by_name: deciderByName,
                        justification: justification,
                        decided_at: new Date().toISOString()
                    });
                    record.set('acknowledged', false);

                    $app.dao().saveRecord(record);
                } catch (notifErr) {
                    $app.logger().error('Failed to create notification in almac_decision API', notifErr);
                }
            }

            return c.json(200, { success: true });
        } catch (err) {
            $app.logger().error('Error in almac_decision API', err);
            throw new BadRequestError(err.message);
        }
    }, $apis.requireRecordAuth());

    // 4. Endpoint para Ciência de Recusa (TRA)
    e.router.add('POST', '/api/acknowledge_transport_refusal', (c) => {
        const data = $apis.requestInfo(c).data;
        const notificationId = data.notification_id;
        const authRecord = c.get('authRecord');

        if (!notificationId) throw new BadRequestError('Missing notification_id');

        try {
            const notification = $app.dao().findRecordById('agenda_cap53_notifications', notificationId);

            if (notification.getString('user') !== authRecord.id) {
                throw new ForbiddenError('Access denied');
            }

            if (notification.getBool('acknowledged')) {
                return c.json(200, { success: true, message: 'Already acknowledged' });
            }

            notification.set('acknowledged', true);
            notification.set('read', true);
            $app.dao().saveRecord(notification);

            const notifData = notification.get('data');
            const deciderId = notifData ? (notifData['rejected_by'] || notifData['confirmed_by']) : null;
            const action = notifData ? notifData['action'] : 'rejected';

            if (deciderId) {
                const notifications = $app.dao().findCollectionByNameOrId('agenda_cap53_notifications');
                const newNotif = new Record(notifications);

                const creatorName = authRecord.getString('name') || authRecord.getString('email');
                const eventId = notification.getString('event');

                newNotif.set('user', deciderId);
                newNotif.set('title', action === 'rejected' ? 'Ciência de Recusa' : 'Ciência de Confirmação');
                newNotif.set('message', `O criador ${creatorName} confirmou ciência da sua decisão (${action === 'rejected' ? 'recusa' : 'confirmação'}) de transporte.`);
                newNotif.set('type', 'acknowledgment');
                newNotif.set('read', false);
                newNotif.set('event', eventId);
                newNotif.set('data', {
                    kind: 'transport_ack',
                    action: action,
                    original_notification_id: notification.id,
                    creator_name: creatorName,
                    acknowledged_at: new Date().toISOString(),
                });

                $app.dao().saveRecord(newNotif);
            }

            return c.json(200, { success: true });
        } catch (err) {
            $app.logger().error('Error in acknowledge_transport_refusal', err);
            throw new BadRequestError(err.message);
        }
    }, $apis.requireRecordAuth());

    // 5. Endpoint para Decisão de Transporte (TRA) - Bypass API Rules
    // (Moved to correct sequential order)
});

