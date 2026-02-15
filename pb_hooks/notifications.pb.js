// 0. Teste de Carga do Hook
$app.logger().info("CRITICAL: notifications.pb.js is starting to load at " + new Date().toISOString());

// --- AUXILIARY FUNCTIONS ---

function createMissingNotificationsForRequest(app, request, event, log) {
    try {
        const itemId = request.getString('item');
        const item = app.dao().findRecordById("agenda_cap53_itens_servico", itemId);
        const itemCategory = item.getString('category');
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
        if (log) log(`Created ${createdCount} missing notifications for item ${item.getString("name")}`);
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

    // --- ALMAC REQUESTS ---
    if (collectionName === 'agenda_cap53_almac_requests') {
        try {
            const eventId = e.record.getString('event');
            const event = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
            createMissingNotificationsForRequest($app, e.record, event, (msg) => $app.logger().info(`[HOOK] ${msg}`));
        } catch (notifErr) {
            $app.logger().error('Error in hook for almac_requests', notifErr);
        }
    }
}

$app.onRecordAfterCreateRequest().add((e) => {
    handleAfterChange(e);
    return e.next();
});

$app.onRecordAfterUpdateRequest().add((e) => {
    handleAfterChange(e);
    return e.next();
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