
const pbUrl = process.env.PB_URL || 'https://centraldedados.duckdns.org';
const adminEmail = process.env.PB_ADMIN_EMAIL;
const adminPass = process.env.PB_ADMIN_PASS;

if (!adminEmail || !adminPass) {
    console.error('ERROR: PB_ADMIN_EMAIL and PB_ADMIN_PASS environment variables are required.');
    process.exit(1);
}

const PREFIX = 'agenda_cap53_';

async function setup() {
    console.log('--- PocketBase Project-Specific Setup ---');

    try {
        const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });
        
        if (!authResponse.ok) {
            throw new Error(`Auth failed: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const token = authData.token;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token
        };

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
                
                // Merge schema carefully: Keep existing fields, add/update new ones
                const updateConfig = { ...existing, ...config };
                
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
            } else {
                console.error(`Error fetching ${config.name}: ${res.status}`);
            }
        }

        // 1. Usuarios (Auth)
        const SECTORS = [
            'CENTRO DE ESTUDOS', 'CGA', 'DAPS', 'DICA', 'DIL', 'DRH', 'DVS', 'GABINETE', 'OUVIDORIA', 'OUTROS'
        ];
        await syncCollection({
            name: `${PREFIX}usuarios`,
            type: 'auth',
            authRule: 'id = @request.auth.id',
            manageRule: '@request.auth.role = "ADMIN"',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '',
            updateRule: 'id = @request.auth.id || @request.auth.role = "ADMIN"',
            deleteRule: 'id = @request.auth.id || @request.auth.role = "ADMIN"',
            options: {
                allowEmailAuth: true,
                requireEmail: true,
                minPasswordLength: 8
            },
            schema: [
                { name: 'name', type: 'text', required: false },
                { name: 'role', type: 'select', required: false, options: { values: ['ADMIN', 'ALMC', 'TRA', 'CE', 'USER', 'DCA'], maxSelect: 1 } },
                { name: 'phone', type: 'text', required: false },
                { name: 'sector', type: 'select', required: false, options: { values: SECTORS, maxSelect: 1 } },
                { name: 'observations', type: 'text', required: false },
                { name: 'avatar', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
                { name: 'status', type: 'select', options: { values: ['Online', 'Ausente', 'Ocupado', 'Offline'], maxSelect: 1 } }
            ]
        });

        // Get IDs for relations
        const usersRes = await fetch(`${pbUrl}/api/collections/${PREFIX}usuarios`, { headers });
        if (!usersRes.ok) throw new Error(`Failed to fetch users collection: ${usersRes.status}`);
        const usersCol = await usersRes.json();
        console.log(`Resolved users collection ID: ${usersCol.id}`);

        // 2. Locais
        await syncCollection({
            name: `${PREFIX}locais`,
            type: 'base',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '@request.auth.role = "ADMIN" || @request.auth.role = "CE"',
            updateRule: '@request.auth.role = "ADMIN" || @request.auth.role = "CE"',
            deleteRule: '@request.auth.role = "ADMIN" || @request.auth.role = "CE"',
            schema: [
                { name: 'name', type: 'text', required: true, unique: true },
                { name: 'description', type: 'text' },
                { name: 'capacity', type: 'number' },
                { name: 'conflict_control', type: 'bool' },
                { name: 'is_available', type: 'bool' },
                { name: 'resources', type: 'json', options: { maxSize: 2000000 } }
            ]
        });
        const locaisRes = await fetch(`${pbUrl}/api/collections/${PREFIX}locais`, { headers });
        if (!locaisRes.ok) throw new Error(`Failed to fetch locais collection: ${locaisRes.status}`);
        const locaisCol = await locaisRes.json();
        console.log(`Resolved locais collection ID: ${locaisCol.id}`);

        // 2.1 Tipos de Evento
        await syncCollection({
            name: `${PREFIX}tipos_evento`,
            type: 'base',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '@request.auth.role = "ADMIN" || @request.auth.role = "CE"',
            updateRule: '@request.auth.role = "ADMIN" || @request.auth.role = "CE"',
            deleteRule: '@request.auth.role = "ADMIN" || @request.auth.role = "CE"',
            schema: [
                { name: 'name', type: 'text', required: true, unique: true },
                { name: 'active', type: 'bool' }
            ]
        });
        const tiposRes = await fetch(`${pbUrl}/api/collections/${PREFIX}tipos_evento`, { headers });
        if (!tiposRes.ok) throw new Error(`Failed to fetch tipos_evento collection: ${tiposRes.status}`);
        const tiposCol = await tiposRes.json();
        console.log(`Resolved tipos_evento collection ID: ${tiposCol.id}`);

        // 3. Itens Servico
        await syncCollection({
            name: `${PREFIX}itens_servico`,
            type: 'base',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC"',
            updateRule: '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC"',
            deleteRule: '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC"',
            schema: [
                { name: 'name', type: 'text', required: true, unique: true },
                { name: 'category', type: 'select', required: true, options: { values: ['ALMOXARIFADO', 'COPA'], maxSelect: 1 } },
                { name: 'stock', type: 'number', required: false },
                { name: 'unit', type: 'text' }
            ]
        });
        const itemsRes = await fetch(`${pbUrl}/api/collections/${PREFIX}itens_servico`, { headers });
        if (!itemsRes.ok) throw new Error(`Failed to fetch items collection: ${itemsRes.status}`);
        const itemsCol = await itemsRes.json();
        console.log(`Resolved items collection ID: ${itemsCol.id}`);

        // 3. Eventos
        await syncCollection({
            name: `${PREFIX}eventos`,
            type: 'base',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '@request.auth.id != ""',
            updateRule: '@request.auth.id = user || @request.auth.role = "ADMIN" || @request.auth.role = "TRA"',
            deleteRule: '@request.auth.id = user || @request.auth.role = "ADMIN"',
            schema: [
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'text' },
                { name: 'observacoes', type: 'text' },
                { name: 'date_start', type: 'date', required: true },
                { name: 'date_end', type: 'date', required: true },
                { name: 'location', type: 'relation', options: { collectionId: locaisCol.id, maxSelect: 1, cascadeDelete: true } },
                { name: 'user', type: 'relation', options: { collectionId: usersCol.id, maxSelect: 1, cascadeDelete: true } },
                { name: 'participants', type: 'relation', options: { collectionId: usersCol.id, maxSelect: 99 } },
                { name: 'status', type: 'select', options: { values: ['active', 'canceled'], maxSelect: 1 } },
                
                // Added missing fields with maxSize option for JSON
                { name: 'type', type: 'text' },
                { name: 'custom_location', type: 'text' },
                { name: 'unidades', type: 'json', options: { maxSize: 2000000 } },
                { name: 'categorias_profissionais', type: 'json', options: { maxSize: 2000000 } },
                { name: 'almoxarifado_items', type: 'json', options: { maxSize: 2000000 } },
                { name: 'copa_items', type: 'json', options: { maxSize: 2000000 } },
                { name: 'transporte_suporte', type: 'bool' },
                { name: 'transporte_status', type: 'select', options: { values: ['pending', 'confirmed', 'rejected'], maxSelect: 1 } },
                { name: 'transporte_origem', type: 'text' },
                { name: 'transporte_destino', type: 'text' },
                { name: 'transporte_horario_levar', type: 'text' },
                { name: 'transporte_horario_buscar', type: 'text' },
                { name: 'transporte_obs', type: 'text' },
                { name: 'transporte_justification', type: 'text' },
                { name: 'participants_status', type: 'json', options: { maxSize: 2000000 } }
            ]
        });
        const eventosRes = await fetch(`${pbUrl}/api/collections/${PREFIX}eventos`, { headers });
        const eventosCol = await eventosRes.json();


        // 4. Almac Requests (Missing)
        await syncCollection({
            name: `${PREFIX}almac_requests`,
            type: 'base',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '@request.auth.id != ""',
            updateRule: '@request.auth.id != ""', // Allow updates (e.g. status)
            deleteRule: '@request.auth.id != ""',
            schema: [
                { name: 'event', type: 'relation', options: { collectionId: eventosCol.id, maxSelect: 1, cascadeDelete: true } },
                { name: 'item', type: 'relation', options: { collectionId: itemsCol.id, maxSelect: 1, cascadeDelete: true } },
                { name: 'quantity', type: 'number' },
                { name: 'status', type: 'select', options: { values: ['pending', 'approved', 'rejected'], maxSelect: 1 } },
                { name: 'created_by', type: 'relation', options: { collectionId: usersCol.id, maxSelect: 1, cascadeDelete: true } },
                { name: 'justification', type: 'text' }
            ]
        });
        const requestsRes = await fetch(`${pbUrl}/api/collections/${PREFIX}almac_requests`, { headers });
        const requestsCol = await requestsRes.json();


        // 5. Participantes (New Relational System)
        await syncCollection({
            name: `${PREFIX}participantes`,
            type: 'base',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            createRule: '@request.auth.id != ""',
            updateRule: 'user = @request.auth.id || @request.auth.role = "ADMIN" || @request.auth.role = "CE"',
            deleteRule: '@request.auth.role = "ADMIN" || @request.auth.role = "CE"',
            schema: [
                { name: 'event', type: 'relation', options: { collectionId: eventosCol.id, maxSelect: 1, cascadeDelete: true }, required: true },
                { name: 'user', type: 'relation', options: { collectionId: usersCol.id, maxSelect: 1, cascadeDelete: true }, required: true },
                { name: 'status', type: 'select', options: { values: ['pending', 'accepted', 'rejected'], maxSelect: 1 }, required: true },
                { name: 'justification', type: 'text' }
            ]
        });


        // 6. Notifications
        await syncCollection({
            name: `${PREFIX}notifications`,
            type: 'base',
            listRule: 'user = @request.auth.id',
            viewRule: 'user = @request.auth.id',
            createRule: '@request.auth.id != ""',
            updateRule: 'user = @request.auth.id',
            deleteRule: 'user = @request.auth.id',
            schema: [
                { name: 'user', type: 'relation', options: { collectionId: usersCol.id, maxSelect: 1, cascadeDelete: true }, required: true },
                { name: 'title', type: 'text', required: true },
                { name: 'message', type: 'text', required: true },
                { name: 'type', type: 'text' },
                { name: 'read', type: 'bool' },
                { name: 'event', type: 'relation', options: { collectionId: eventosCol.id, maxSelect: 1, cascadeDelete: true } },
                { name: 'invite_status', type: 'select', options: { values: ['pending', 'accepted', 'rejected'], maxSelect: 1 } },
                
                // Added missing fields
                { name: 'related_request', type: 'text' }, 
                { name: 'data', type: 'json', options: { maxSize: 2000000 } },
                { name: 'acknowledged', type: 'bool' }
            ]
        });

        // 6. Audit Logs
        await syncCollection({
            name: `agenda_audit_logs`,
            type: 'base',
            listRule: '@request.auth.role = "ADMIN"',
            viewRule: '@request.auth.role = "ADMIN"',
            createRule: '@request.auth.id != ""',
            updateRule: null,
            deleteRule: null,
            schema: [
                { name: 'user', type: 'relation', options: { collectionId: usersCol.id, maxSelect: 1, cascadeDelete: true }, required: true },
                { name: 'action', type: 'text', required: true },
                { name: 'target_type', type: 'text', required: true },
                { name: 'target_id', type: 'text' },
                { name: 'details', type: 'json', options: { maxSize: 2000000 } }
            ]
        });

        // Create Mock Users if empty
        console.log('Ensuring mock users and roles...');
        const mockUsers = [
            { email: 'admin@cap53.com', password: 'password123', name: 'Admin', role: 'ADMIN' },
            { email: 'almac@cap53.com', password: 'password123', name: 'Almoxarifado', role: 'ALMC' },
            { email: 'tra@cap53.com', password: 'password123', name: 'Transporte', role: 'TRA' },
            { email: 'ce@cap53.com', password: 'password123', name: 'Centro de Estudos', role: 'CE' }
        ];

        for (const user of mockUsers) {
            const checkRes = await fetch(`${pbUrl}/api/collections/${PREFIX}usuarios/records?filter=(email='${user.email}')`, { headers });
            const checkData = await checkRes.json();

            if (checkData.totalItems === 0) {
                console.log(`Creating mock user: ${user.email}`);
                const createRes = await fetch(`${pbUrl}/api/collections/${PREFIX}usuarios/records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ...user,
                        passwordConfirm: user.password,
                        emailVisibility: true,
                        verified: true
                    })
                });
                if (!createRes.ok) {
                    const err = await createRes.json();
                    console.error(`Error creating user ${user.email}:`, JSON.stringify(err, null, 2));
                } else {
                    console.log(`User ${user.email} created.`);
                }
            } else {
                console.log(`Updating role for existing user: ${user.email}`);
                const existing = checkData.items[0];
                const patchRes = await fetch(`${pbUrl}/api/collections/${PREFIX}usuarios/records/${existing.id}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ role: user.role })
                });
                if (!patchRes.ok) {
                    const err = await patchRes.json();
                    console.error(`Error patching role for ${user.email}:`, JSON.stringify(err, null, 2));
                } else {
                    console.log(`Role updated for ${user.email}.`);
                }
            }
        }

        // Create Mock Tipos de Evento if empty
        const tiposRecordsRes = await fetch(`${pbUrl}/api/collections/${PREFIX}tipos_evento/records?perPage=1`, { headers });
        const tiposRecords = await tiposRecordsRes.json();

        if (!tiposRecords.items || tiposRecords.items.length === 0) {
            console.log('Creating mock event types...');
            const mockTipos = [
                { name: 'Reunião', active: true },
                { name: 'Treinamento', active: true },
                { name: 'Workshop', active: true },
                { name: 'Planejamento', active: true }
            ];
            for (const t of mockTipos) {
                await fetch(`${pbUrl}/api/collections/${PREFIX}tipos_evento/records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(t)
                });
            }
        }

        // Create Mock Locais if empty
        const locaisRecordsRes = await fetch(`${pbUrl}/api/collections/${PREFIX}locais/records?perPage=1`, { headers });
        const locaisRecords = await locaisRecordsRes.json();

        if (!locaisRecords.items || locaisRecords.items.length === 0) {
            console.log('Creating mock locations...');
            const mockLocs = [
                { name: 'Auditório Principal', description: 'Capacidade 100 pessoas', capacity: 100 },
                { name: 'Sala de Reunião 01', description: 'Capacidade 10 pessoas', capacity: 10 }
            ];
            for (const l of mockLocs) {
                await fetch(`${pbUrl}/api/collections/${PREFIX}locais/records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(l)
                });
            }
        }

        console.log('\n--- Setup Complete ---');

    } catch (err) {
        console.error('CRITICAL ERROR:', err.message);
    }
}

setup();
