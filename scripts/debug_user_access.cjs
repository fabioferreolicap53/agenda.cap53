const PocketBase = require('pocketbase/cjs');

async function main() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');

    try {
        console.log("Authenticating as fabio@cap53.com...");
        await pb.collection('agenda_cap53_usuarios').authWithPassword('fabio@cap53.com', '12345678');
        console.log("Auth successful!");

        // 1. Fetch Notifications with expand
        console.log("\n--- Fetching Notifications ---");
        const notifications = await pb.collection('agenda_cap53_notifications').getList(1, 5, {
            sort: '-created',
            expand: 'event,related_event,related_request,related_request.item,related_request.created_by,event.user',
        });

        for (const n of notifications.items) {
            if (n.message.includes('Almoxarifado') || n.type === 'request_decision') {
                console.log(`\nNotification ID: ${n.id}`);
                console.log(`Message: ${n.message}`);
                
                if (!n.expand) {
                    console.log("ERROR: 'expand' is MISSING on notification object.");
                } else {
                    console.log("Expand keys:", Object.keys(n.expand));
                    
                    if (!n.expand.related_request) {
                        console.log("ERROR: 'related_request' is MISSING in expand.");
                        console.log("related_request ID in record:", n.related_request);
                    } else {
                        const rr = n.expand.related_request;
                        console.log("related_request found. ID:", rr.id);
                        
                        if (!rr.expand) {
                            console.log("ERROR: 'expand' is MISSING on related_request object.");
                        } else {
                            console.log("related_request.expand keys:", Object.keys(rr.expand));
                            
                            if (!rr.expand.item) {
                                console.log("ERROR: 'item' is MISSING in related_request.expand.");
                                console.log("item ID in request record:", rr.item);
                                
                                // Try to fetch item directly to check permissions
                                if (rr.item) {
                                    try {
                                        console.log(`Attempting to fetch item ${rr.item} directly...`);
                                        const item = await pb.collection('agenda_cap53_itens').getOne(rr.item);
                                        console.log("Success! Item name:", item.name);
                                    } catch (e) {
                                        console.log("Failed to fetch item directly:", e.message);
                                    }
                                }
                            } else {
                                console.log("SUCCESS: Item found:", rr.expand.item.name);
                            }
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error("Critical Error:", error);
    }
}

main();
