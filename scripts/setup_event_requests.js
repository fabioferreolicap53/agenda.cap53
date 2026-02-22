import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

async function setupEventRequests() {
    try {
        const endpoints = ['/api/superusers/auth-with-password', '/api/admins/auth-with-password'];
        let authenticated = false;

        for (const endpoint of endpoints) {
            try {
                const res = await fetch(`${PB_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
                });
                if (res.ok) {
                    const data = await res.json();
                    pb.authStore.save(data.token, data.admin || data.superuser);
                    authenticated = true;
                    console.log(`Authenticated via ${endpoint}`);
                    break;
                }
            } catch (e) { }
        }

        if (!authenticated) {
            console.error('Auth Failed');
            return;
        }

        const collections = await pb.collections.getFullList();
        const usersCol = collections.find(c => c.name === 'agenda_cap53_usuarios');
        const eventsCol = collections.find(c => c.name === 'agenda_cap53_eventos');

        if (!usersCol || !eventsCol) {
            console.error('Required collections not found');
            return;
        }

        // Create Event Requests collection
        const requestsName = 'agenda_cap53_solicitacoes_evento';
        let requestsCol = collections.find(c => c.name === requestsName);

        if (!requestsCol) {
            console.log(`Creating ${requestsName} collection...`);
            requestsCol = await pb.collections.create({
                name: requestsName,
                type: 'base',
                schema: [
                    {
                        name: 'event',
                        type: 'relation',
                        required: true,
                        options: {
                            collectionId: eventsCol.id,
                            maxSelect: 1,
                            cascadeDelete: true
                        }
                    },
                    {
                        name: 'user',
                        type: 'relation',
                        required: true,
                        options: {
                            collectionId: usersCol.id,
                            maxSelect: 1,
                            cascadeDelete: true
                        }
                    },
                    {
                        name: 'status',
                        type: 'select',
                        required: true,
                        options: {
                            values: ['pending', 'approved', 'rejected'],
                            maxSelect: 1
                        }
                    },
                    {
                        name: 'role',
                        type: 'select',
                        required: false,
                        options: {
                            values: ['PARTICIPANTE', 'ORGANIZADOR', 'COORGANIZADOR'],
                            maxSelect: 1
                        }
                    },
                    {
                        name: 'message',
                        type: 'text',
                        options: {
                            min: 0,
                            max: 250
                        }
                    }
                ],
                // Rules
                // Anyone authenticated can create a request
                // Only requester or event creator can list/view
                // Only event creator can update (approve/reject)
                // Only requester or creator can delete
                listRule: '@request.auth.id != "" && (user = @request.auth.id || event.user = @request.auth.id)',
                viewRule: '@request.auth.id != "" && (user = @request.auth.id || event.user = @request.auth.id)',
                createRule: '@request.auth.id != "" && user = @request.auth.id',
                updateRule: '@request.auth.id != "" && event.user = @request.auth.id',
                deleteRule: '@request.auth.id != "" && (user = @request.auth.id || event.user = @request.auth.id)'
            });
            console.log(`${requestsName} created successfully`);
        } else {
            console.log(`${requestsName} already exists, checking for 'role' field...`);
            // Check if role field exists, if not, add it
            const currentSchema = requestsCol.schema || [];
            if (!currentSchema.find(f => f.name === 'role')) {
                console.log("Adding 'role' field to agenda_cap53_solicitacoes_evento...");
                await pb.collections.update(requestsCol.id, {
                    schema: [
                        ...currentSchema,
                        {
                            name: 'role',
                            type: 'select',
                            required: false,
                            options: {
                                values: ['PARTICIPANTE', 'ORGANIZADOR', 'COORGANIZADOR'],
                                maxSelect: 1
                            }
                        }
                    ]
                });
                console.log("'role' field added successfully");
            }
        }

    } catch (error) {
        console.error('Error setting up event requests:', error);
    }
}

setupEventRequests();

