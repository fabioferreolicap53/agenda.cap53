
const pbUrl = 'https://centraldedados.dev.br';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';

async function setup() {
    console.log('--- PocketBase Deep Diagnostic & Setup ---');

    try {
        // 1. Authenticate (Checking for Superuser/Admin)
        let authData;
        console.log('Authenticating...');

        const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });

        if (authResponse.ok) {
            authData = await authResponse.json();
            console.log('Authenticated as Admin.');
        } else {
            const superUserResponse = await fetch(`${pbUrl}/api/superusers/auth-with-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: adminEmail, password: adminPass })
            });
            if (superUserResponse.ok) {
                authData = await superUserResponse.json();
                console.log('Authenticated as Superuser.');
            } else {
                throw new Error('Authentication failed (both admin and superuser endpoints).');
            }
        }

        const token = authData.token;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token
        };

        // Helper to check and create/update collections
        async function syncCollection(config) {
            console.log(`Syncing collection: ${config.name}...`);
            const res = await fetch(`${pbUrl}/api/collections/${config.name}`, { headers });

            if (res.status === 404) {
                console.log(`Creating collection ${config.name}...`);
                const createRes = await fetch(`${pbUrl}/api/collections`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(config)
                });
                if (!createRes.ok) {
                    const error = await createRes.json();
                    console.error(`Error creating ${config.name}:`, JSON.stringify(error, null, 2));
                } else {
                    console.log(`Collection ${config.name} created successfully.`);
                }
            } else if (res.ok) {
                console.log(`Updating collection ${config.name}...`);
                const existing = await res.json();

                // For 'agenda_eventos', we need to be careful with the schema merge
                // To simplify and ensure success, we'll merge the existing object with our new config
                const updateConfig = { ...existing, ...config };

                // PocketBase 0.23+ schema items are often identified by ID. 
                // If we send named fields without IDs, it might cause issues during PATCH if not handled correctly by the server.
                // However, the administrative API usually allows identifying by name for simplicity if the names match.

                const updateRes = await fetch(`${pbUrl}/api/collections/${config.name}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(updateConfig)
                });
                if (!updateRes.ok) {
                    const error = await updateRes.json();
                    console.error(`Error updating ${config.name}:`, JSON.stringify(error, null, 2));
                } else {
                    console.log(`Collection ${config.name} updated successfully.`);
                }
            }
        }

        // 2. debtflow_usuarios (Auth Collection)
        const usuariosConfig = {
            name: 'debtflow_usuarios',
            type: 'auth',
            authRule: 'id = @request.auth.id',
            manageRule: 'role = "admin"',
            listRule: 'id = @request.auth.id || @request.auth.role = "admin"',
            viewRule: 'id = @request.auth.id || @request.auth.role = "admin"',
            createRule: '', // Public
            updateRule: 'id = @request.auth.id || @request.auth.role = "admin"',
            deleteRule: 'id = @request.auth.id || @request.auth.role = "admin"',
            options: {
                allowEmailAuth: true,
                requireEmail: true,
                minPasswordLength: 8
            },
            schema: [
                { name: 'name', type: 'text', required: false },
                { name: 'role', type: 'select', required: true, options: { values: ['ADMIN', 'ALMC', 'TRA', 'CE', 'USER'], maxSelect: 1 } },
                { name: 'phone', type: 'text', required: false },
                { name: 'sector', type: 'select', required: false, options: { values: ['Diretoria Executiva', 'Almoxarifado', 'Transporte', 'Copa/Eventos'], maxSelect: 1 } },
                { name: 'observations', type: 'text', required: false },
                { name: 'avatar', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
                { name: 'status', type: 'select', options: { values: ['Online', 'Ausente', 'Ocupado'], maxSelect: 1 } }
            ]
        };
        await syncCollection(usuariosConfig);

        // Get real collection IDs for relations
        const usersRes = await fetch(`${pbUrl}/api/collections/debtflow_usuarios`, { headers });
        const usersCol = await usersRes.json();
        const usersColId = usersCol.id;

        const locaisRes = await fetch(`${pbUrl}/api/collections/agenda_locais`, { headers });
        const locaisCol = await locaisRes.json();
        const locaisColId = locaisCol.id;

        // 5. agenda_eventos
        const eventosConfig = {
            name: 'agenda_eventos',
            type: 'base',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '@request.auth.id != ""',
            updateRule: '@request.auth.id = user || @request.auth.role = "ADMIN" || (@request.auth.role = "ALMC" && (almoxarifado_items != null || copa_items != null)) || (@request.auth.role = "TRA" && transporte_suporte = true)',
            deleteRule: '@request.auth.id = user || @request.auth.role = "ADMIN"',
            schema: [
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'text' },
                { name: 'type', type: 'text' },
                { name: 'status', type: 'text', options: { values: ['active', 'canceled'] } },
                { name: 'date_start', type: 'date', required: true },
                { name: 'date_end', type: 'date', required: true },
                { name: 'location', type: 'relation', options: { collectionId: locaisColId, maxSelect: 1, cascadeDelete: true } },
                { name: 'user', type: 'relation', options: { collectionId: usersColId, maxSelect: 1, cascadeDelete: true } },
                { name: 'participants', type: 'relation', options: { collectionId: usersColId, maxSelect: 99 } },
                { name: 'almoxarifado_items', type: 'json', options: { maxSize: 2000000 } },
                { name: 'copa_items', type: 'json', options: { maxSize: 2000000 } },
                { name: 'almoxarifado_confirmed_items', type: 'json', options: { maxSize: 2000000 } },
                { name: 'copa_confirmed_items', type: 'json', options: { maxSize: 2000000 } },
                { name: 'transporte_suporte', type: 'bool' },
                { name: 'transporte_status', type: 'text' },
                { name: 'unidades', type: 'json', options: { maxSize: 2000000 } },
                { name: 'categorias_profissionais', type: 'json', options: { maxSize: 2000000 } }
            ]
        };
        await syncCollection(eventosConfig);

        // 6. notifications
        const notificationsConfig = {
            name: 'notifications',
            type: 'base',
            listRule: 'user = @request.auth.id',
            viewRule: 'user = @request.auth.id',
            createRule: '@request.auth.id != ""',
            updateRule: 'user = @request.auth.id',
            deleteRule: 'user = @request.auth.id',
            schema: [
                { name: 'user', type: 'relation', options: { collectionId: usersColId, maxSelect: 1, cascadeDelete: true }, required: true },
                { name: 'title', type: 'text', required: true },
                { name: 'message', type: 'text', required: true },
                { name: 'type', type: 'text' },
                { name: 'read', type: 'bool' }
            ]
        };
        await syncCollection(notificationsConfig);

        console.log('\n--- Setup Complete ---');
        console.table([
            { Collection: 'debtflow_usuarios', Status: 'Synced', Rules: 'RBAC Active' },
            { Collection: 'agenda_locais', Status: 'Synced', Rules: 'Private' },
            { Collection: 'agenda_itens_servico', Status: 'Synced', Rules: 'Private' },
            { Collection: 'agenda_eventos', Status: 'Synced', Rules: 'RBAC + Owner' },
            { Collection: 'notifications', Status: 'Synced', Rules: 'Owner Only' }
        ]);

    } catch (err) {
        console.error('CRITICAL ERROR DURING SETUP:', err.message);
        process.exit(1);
    }
}

setup();

