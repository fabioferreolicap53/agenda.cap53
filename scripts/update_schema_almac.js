

const pbUrl = 'https://centraldedados.duckdns.org';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';

const PREFIX = 'agenda_cap53_';

async function updateSchema() {
    console.log('--- Updating Schema for Almac Management ---');

    try {
        const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });
        const authData = await authResponse.json();
        const token = authData.token;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token
        };

        // Helper to sync collection
        async function syncCollection(config) {
            console.log(`Syncing collection: ${config.name}`);
            try {
                // Check if exists
                let collection;
                try {
                    const res = await fetch(`${pbUrl}/api/collections/${config.name}`, { headers });
                    if (res.ok) collection = await res.json();
                } catch (e) { }

                if (collection) {
                    // Update
                    console.log(`Updating ${config.name}...`);
                    await fetch(`${pbUrl}/api/collections/${collection.id}`, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify(config)
                    });
                } else {
                    // Create
                    console.log(`Creating ${config.name}...`);
                    await fetch(`${pbUrl}/api/collections`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(config)
                    });
                }
            } catch (error) {
                console.error(`Error syncing ${config.name}:`, error);
            }
        }

        // Get IDs for relations
        const usersRes = await fetch(`${pbUrl}/api/collections/${PREFIX}usuarios`, { headers });
        const usersCol = await usersRes.json();
        
        const eventosRes = await fetch(`${pbUrl}/api/collections/${PREFIX}eventos`, { headers });
        const eventosCol = await eventosRes.json();

        const itemsRes = await fetch(`${pbUrl}/api/collections/${PREFIX}itens_servico`, { headers });
        const itemsCol = await itemsRes.json();

        // 1. New Collection: Almac Requests
        await syncCollection({
            name: `${PREFIX}almac_requests`,
            type: 'base',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '@request.auth.id != ""',
            updateRule: '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC"',
            deleteRule: '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC" || @request.auth.id = created_by',
            schema: [
                { name: 'event', type: 'relation', options: { collectionId: eventosCol.id, maxSelect: 1, cascadeDelete: true }, required: true },
                { name: 'item', type: 'relation', options: { collectionId: itemsCol.id, maxSelect: 1, cascadeDelete: true }, required: true },
                { name: 'quantity', type: 'number', required: false }, // Optional quantity
                { name: 'status', type: 'select', options: { values: ['pending', 'approved', 'rejected'], maxSelect: 1 }, required: true },
                { name: 'justification', type: 'text', required: false },
                { name: 'created_by', type: 'relation', options: { collectionId: usersCol.id, maxSelect: 1, cascadeDelete: true }, required: true }
            ]
        });

        console.log('Schema update complete.');

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

updateSchema();
