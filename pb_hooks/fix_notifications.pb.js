/// <reference path="../pb_data/types.d.ts" />

const fixNotifications = () => {
    try {
        const records = $app.dao().findRecordsByFilter(
            "agenda_cap53_notifications",
            "type = 'request_decision' || type = 'almc_item_request'",
            "-created",
            1000
        );

        let updatedCount = 0;

        for (const record of records) {
            try {
                const reqId = record.getString("related_request");
                if (!reqId) continue;

                let req;
                try {
                    req = $app.dao().findRecordById("agenda_cap53_almac_requests", reqId);
                } catch (e) {
                    continue; 
                }

                const itemId = req.getString("item");
                if (!itemId) continue;

                let item;
                try {
                    item = $app.dao().findRecordById("agenda_cap53_itens", itemId);
                } catch (e) {
                    continue; 
                }

                const itemName = item.getString("name");
                
                const existingDataVal = record.get("data");
                let newData = {};
                
                if (existingDataVal) {
                    try {
                        newData = JSON.parse(JSON.stringify(existingDataVal));
                    } catch (e) {
                        newData = {};
                    }
                }

                if (!newData.item_name) {
                    newData.item_name = itemName;
                    newData.quantity = req.getInt("quantity");

                    record.set("data", newData);
                    record.set("meta", JSON.stringify(newData));
                    
                    $app.dao().saveRecord(record);
                    updatedCount++;
                }
            } catch (e) {
                $app.logger().error(`Error fixing notification ${record.id}: ${e}`);
            }
        }
        
        if (updatedCount > 0) {
            $app.logger().info(`[FIX_NOTIFICATIONS] Fixed ${updatedCount} notifications on startup/request.`);
        }
        return updatedCount;
    } catch (err) {
        $app.logger().error(`[FIX_NOTIFICATIONS_FATAL] ${err}`);
        return 0;
    }
};

// Run on startup automatically - DISABLED TO PREVENT CRASH
// onAfterBootstrap((e) => {
//    try {
//        fixNotifications();
//    } catch (err) {
//        $app.logger().error("Failed to run fixNotifications on bootstrap: " + err);
//    }
// });

// API endpoint for manual trigger
routerAdd("POST", "/api/fix-notifications", (c) => {
    const count = fixNotifications();
    return c.json(200, { message: "Fixed notifications", count: count });
}, $apis.requireRecordAuth());
