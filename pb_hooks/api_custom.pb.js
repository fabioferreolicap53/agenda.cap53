
routerAdd("POST", "/api/notifications/clear_safe", (c) => {
    const user = c.get("authRecord");
    if (!user) {
        return c.json(401, { message: "Unauthorized" });
    }

    // Determine scope
    // If 'all' param is true AND user is ADMIN, clear all.
    // Otherwise, clear only for the authenticated user.
    const clearAll = c.queryParam("all") === "true";
    if (clearAll && user.getString("role") !== "ADMIN") {
        return c.json(403, { message: "Forbidden: Only admins can clear all notifications." });
    }

    // Optional: filter by 'read=true' if it's a history clear
    const onlyRead = c.queryParam("read_only") === "true";

    let filter = "";
    if (!clearAll) {
        filter = `user = '${user.id}'`;
    }
    
    if (onlyRead) {
        const readFilter = "read = true";
        filter = filter ? `(${filter}) && ${readFilter}` : readFilter;
    }

    const notifications = $app.dao().findRecordsByFilter(
        "agenda_cap53_notifications",
        filter
    );

    let deleted = 0;
    let skipped = 0;
    const now = new Date();

    for (const n of notifications) {
        let canDelete = true;

        // Logic to protect future event requests
        const type = n.getString("type");
        
        // Access 'data' field safely
        // In PocketBase JS hooks, JSON fields are automatically unmarshaled to objects
        const data = n.get("data"); 
        const kind = data ? data.kind : null;

        const isRequest = 
            type === 'service_request' ||
            type === 'almc_item_request' ||
            type === 'transport_request' ||
            kind === 'almc_item_request' ||
            kind === 'service_request' ||
            kind === 'transport_request';

        if (isRequest) {
            const eventId = n.getString("event");
            if (eventId) {
                try {
                    const event = $app.dao().findRecordById("agenda_cap53_eventos", eventId);
                    if (event) {
                        const dateStart = event.getString("date_start");
                        if (dateStart) {
                            // PocketBase dates are typically "2006-01-02 15:04:05.000Z"
                            const eventDate = new Date(dateStart);
                            if (eventDate > now) {
                                canDelete = false;
                            }
                        }
                    }
                } catch (e) {
                    // Event might be deleted or not found.
                    // If event is deleted, we can delete the notification.
                }
            }
        }

        if (canDelete) {
            try {
                $app.dao().deleteRecord(n);
                deleted++;
            } catch (e) {
                $app.logger().error(`Failed to delete notification ${n.id}: ${e}`);
            }
        } else {
            skipped++;
        }
    }

    return c.json(200, { deleted, skipped });
});
