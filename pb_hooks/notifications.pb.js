/// <reference path="../pb_data/types.d.ts" />

// 0. Teste de Carga do Hook
$app.logger().info("CRITICAL: notifications.pb.js is starting to load at " + new Date().toISOString());

$app.onBeforeServe((e) => {
    $app.logger().info("Entering onBeforeServe...");
    // Health Check Endpoint - MUST BE FIRST
    e.router.add('GET', '/api/hooks_health', (c) => {
        return c.json(200, { 
            status: 'ok', 
            message: 'Hooks are loaded and running', 
            time: new Date().toISOString(),
            version: '1.2'
        });
    });

    // 0. Teste de Endpoint - DELETE THIS AFTER TEST
    e.router.add('GET', '/api/test_route', (c) => {
        return c.json(200, { message: 'Route is active' });
    });

    // 5. Endpoint para Decisão de Transporte (TRA) - Bypass API Rules
    $app.logger().info("Registering /api/transport_decision route...");
    e.router.add('POST', '/api/transport_decision', (c) => {
        const data = $apis.requestInfo(c).data;
        $app.logger().info("Received data: " + JSON.stringify(data));
        const eventId = data.event_id;
        const status = data.status; // 'confirmed' | 'rejected'
        const justification = data.justification || 'Ação realizada pelo setor de transporte.';
        const authRecord = c.get('authRecord');

        if (!eventId || !status) {
            $app.logger().warn(`Transport Decision API: Missing parameters. eventId=${eventId}, status=${status}`);
            return c.json(400, { message: 'Missing event_id or status' });
        }
        
        const userRole = (authRecord.getString('role') || '').toUpperCase();
        if (userRole !== 'TRA' && userRole !== 'ADMIN') {
            $app.logger().warn(`Transport Decision API: Forbidden access by user ${authRecord.id} with role ${userRole}`);
            return c.json(403, { message: 'Only TRA or ADMIN users can make transport decisions' });
        }

        try {
            $app.logger().info(`Transport Decision API Attempt: Event=${eventId}, Status=${status}, User=${authRecord.id}`);
            const event = $app.dao().findRecordById('agenda_cap53_eventos', eventId);
            
            const oldStatus = event.getString('transporte_status');
            event.set('transporte_status', status);
            event.set('transporte_justification', justification);
            
            $app.dao().saveRecord(event);
            $app.logger().info(`Transport Decision saved successfully: Event=${eventId}, Status=${status}`);

            // --- NOVA LÓGICA DE NOTIFICAÇÃO DIRETA (Bypass Hook) ---
            try {
                const creatorId = event.getString('user');
                if (creatorId) {
                    const notifications = $app.dao().findCollectionByNameOrId('agenda_cap53_notifications');
                    const record = new Record(notifications);
                    const eventTitle = event.getString('title') || 'Evento';

                    record.set('user', creatorId);
                    record.set('read', false);
                    record.set('event', eventId);
                    record.set('acknowledged', false);
                    record.set('type', status === 'rejected' ? 'refusal' : 'system');
                    record.set('title', status === 'rejected' ? 'Transporte Recusado' : 'Transporte Confirmado');
                    
                    const msgBase = status === 'rejected' ? 'foi recusada' : 'foi confirmada';
                    record.set('message', `A solicitação de transporte para o evento "${eventTitle}" ${msgBase}.\n\nJustificativa: ${justification}`);
                    
                    record.set('data', {
                        kind: 'transport_decision',
                        action: status,
                        decided_by: authRecord.id,
                        decided_by_name: authRecord.getString('name') || authRecord.getString('email'),
                        rejected_by: status === 'rejected' ? authRecord.id : undefined,
                        rejected_by_name: status === 'rejected' ? (authRecord.getString('name') || authRecord.getString('email')) : undefined,
                        justification: justification,
                        decided_at: new Date().toISOString()
                    });

                    $app.dao().saveRecord(record);
                    $app.logger().info(`Direct Notification Created for ${creatorId}`);
                }
            } catch (notifErr) {
                $app.logger().error('Error creating direct notification', notifErr);
            }
            // -------------------------------------------------------

            return c.json(200, { success: true });
        } catch (err) {
            $app.logger().error('Error in transport_decision API', err);
            return c.json(500, { message: err.message || 'Internal server error' });
        }
    }, $apis.requireRecordAuth());

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

            // Notify requester and event creator
            const requesterId = request.getString('created_by');
            const eventId = request.getString('event');
            
            if (requesterId || eventId) {
                try {
                    const notifications = $app.dao().findCollectionByNameOrId('agenda_cap53_notifications');
                    const itemName = item ? item.getString('name') : 'Item';
                    const deciderByName = authRecord.getString('name') || authRecord.getString('email');
                    
                    let eventTitle = 'Evento';
                    let eventCreatorId = null;
                    
                    if (eventId) {
                        try {
                            const event = $app.dao().findRecordById('agenda_cap53_eventos', eventId);
                            eventTitle = event.getString('title') || 'Evento';
                            eventCreatorId = event.getString('user');
                        } catch (e) {
                            $app.logger().warn('Failed to fetch event for notification', e);
                        }
                    }

                    const message = `A solicitação do item "${itemName}" para o evento "${eventTitle}" foi ${action === 'approved' ? 'aprovada' : 'recusada'}.${justification ? ' Motivo: ' + justification : ''}`;
                    const title = action === 'approved' ? 'Item Aprovado' : 'Item Recusado';
                    const type = action === 'approved' ? 'system' : 'refusal';

                    const recipients = new Set();
                    if (requesterId) recipients.add(requesterId);
                    if (eventCreatorId) recipients.add(eventCreatorId);

                    recipients.forEach(userId => {
                        const record = new Record(notifications);
                        record.set('user', userId);
                        record.set('title', title);
                        record.set('message', message);
                        record.set('type', type);
                        record.set('read', false);
                        record.set('related_request', request.id);
                        record.set('event', eventId);
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
                    });
                    
                    $app.logger().info(`Item decision notifications sent to ${recipients.size} users`);
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
            const deciderId = notifData ? (notifData['decided_by'] || notifData['rejected_by'] || notifData['confirmed_by']) : null;
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
});

// --- CONSOLIDATED HOOKS ---

// 1. BEFORE UPDATE HOOKS
$app.onRecordBeforeUpdateRequest((e) => {
    const collectionName = e.record.collection().name;

    // Rule for agenda_cap53_almac_requests
    if (collectionName === 'agenda_cap53_almac_requests') {
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
    }

    // Rule for agenda_cap53_eventos
    if (collectionName === 'agenda_cap53_eventos') {
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
    }
});

// 2. AFTER UPDATE HOOKS
$app.onRecordAfterUpdateRequest((e) => {
    const collectionName = e.record.collection().name;
    $app.logger().info(`[AFTER UPDATE] Collection: ${collectionName} ID: ${e.record.id}`);

    // --- ALMAC REQUESTS ---
    if (collectionName === 'agenda_cap53_almac_requests') {
        const newStatus = e.record.getString('status');
        const oldStatus = e.original ? e.original.getString('status') : '';

        if ((newStatus === 'rejected' || newStatus === 'approved') && newStatus !== oldStatus) {
            const requesterId = e.record.getString('created_by');
            const eventId = e.record.getString('event');
            
            let deciderById = "";
            let deciderByName = "Sistema";
            
            try {
                if (e.httpContext) {
                    const authRecord = e.httpContext.get("authRecord");
                    if (authRecord) {
                        deciderById = authRecord.id;
                        deciderByName = authRecord.getString("name") || authRecord.getString("email");
                    }
                }
            } catch (err) {}

            if (requesterId || eventId) {
                try {
                    const notifications = $app.dao().findCollectionByNameOrId("agenda_cap53_notifications");
                    
                    let itemName = "Item";
                    try {
                        const item = $app.dao().findRecordById("agenda_cap53_itens_servico", e.record.getString("item"));
                        itemName = item.getString("name") || "Item";
                    } catch (itemErr) {}

                    let eventTitle = "Evento";
                    let eventCreatorId = null;
                    if (eventId) {
                        try {
                            const event = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
                            eventTitle = event.getString("title") || "Evento";
                            eventCreatorId = event.getString("user");
                        } catch (eventErr) {}
                    }

                    const justification = e.record.getString("justification") || "Sem justificativa";
                    const message = `A solicitação do item "${itemName}" para o evento "${eventTitle}" foi ${newStatus === 'approved' ? 'aprovada' : 'recusada'}.${justification ? ' Motivo: ' + justification : ''}`;
                    const title = newStatus === 'approved' ? 'Item Aprovado' : 'Item Recusado';
                    const type = newStatus === 'approved' ? 'system' : 'refusal';

                    const recipients = new Set();
                    if (requesterId) recipients.add(requesterId);
                    if (eventCreatorId) recipients.add(eventCreatorId);

                    recipients.forEach(userId => {
                        if (userId === deciderById) return;
                        const record = new Record(notifications);
                        record.set("user", userId);
                        record.set("title", title);
                        record.set("message", message);
                        record.set("type", type);
                        record.set("read", false);
                        record.set("related_request", e.record.id);
                        record.set("event", eventId);
                        record.set("data", { 
                            kind: "almc_item_decision",
                            action: newStatus,
                            decided_by: deciderById, 
                            decided_by_name: deciderByName,
                            refused_at: new Date().toISOString()
                        });
                        record.set("acknowledged", false);
                        $app.dao().saveRecord(record);
                    });
                } catch (err) {
                    $app.logger().error("Failed to create item decision hook notification", err);
                }
            }
        }
    }

    // --- TRANSPORT REQUESTS (EVENTOS) ---
    if (collectionName === 'agenda_cap53_eventos') {
        const newStatus = e.record.getString('transporte_status');
        const oldStatus = e.original ? e.original.getString('transporte_status') : '';

        if ((newStatus === 'rejected' || newStatus === 'confirmed') && newStatus !== oldStatus) {
            $app.logger().info(`[TRANSPORT] Status change detected: ${oldStatus} -> ${newStatus}`);
            
            let deciderById = '';
            let deciderByName = 'Setor de Transporte';

            if (e.httpContext) {
                try {
                    const authRecord = e.httpContext.get('authRecord');
                    if (authRecord) {
                        deciderById = authRecord.id;
                        deciderByName = authRecord.getString('name') || authRecord.getString('email');
                    }
                } catch (err) {}
            }

            const creatorId = e.record.getString('user');
            if (!creatorId) {
                $app.logger().warn(`[TRANSPORT] ABORTING - No creator ID (user field) found on event`);
                return;
            }

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
                        decided_by: deciderById,
                        decided_by_name: deciderByName,
                        rejected_by: deciderById,
                        rejected_by_name: deciderByName,
                        justification: justification,
                        decided_at: new Date().toISOString(),
                        refused_at: new Date().toISOString(),
                    });
                } else {
                    const justification = e.record.getString('transporte_justification');
                    record.set('title', 'Transporte Confirmado');
                    let message = `A solicitação de transporte para o evento "${eventTitle}" foi confirmada.`;
                    if (justification) message += `\n\nObservação: ${justification}`;
                    record.set('message', message);
                    record.set('type', 'system');
                    record.set('data', {
                        kind: 'transport_decision',
                        action: 'confirmed',
                        decided_by: deciderById,
                        decided_by_name: deciderByName,
                        confirmed_by: deciderById,
                        confirmed_by_name: deciderByName,
                        justification: justification || '',
                        decided_at: new Date().toISOString(),
                        confirmed_at: new Date().toISOString(),
                    });
                }

                $app.dao().saveRecord(record);
                $app.logger().info(`[TRANSPORT] SUCCESS - Notification created for ${creatorId}`);
            } catch (err) {
                $app.logger().error('[TRANSPORT] CRITICAL ERROR creating notification', err);
            }
        }
    }
});

