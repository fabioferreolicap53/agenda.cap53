import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

async function setupMessagesCollection() {
    try {
        // Authenticate using the same logic as list_collections.js
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
        const messagesCollection = collections.find(c => c.name === 'agenda_cap53_mensagens');

        if (!messagesCollection) {
            console.log('Creating agenda_cap53_mensagens collection...');
            await pb.collections.create({
                name: 'agenda_cap53_mensagens',
                type: 'base',
                schema: [
                    {
                        name: 'sender',
                        type: 'relation',
                        required: true,
                        options: {
                            collectionId: collections.find(c => c.name === 'agenda_cap53_usuarios').id,
                            maxSelect: 1
                        }
                    },
                    {
                        name: 'receiver',
                        type: 'relation',
                        required: true,
                        options: {
                            collectionId: collections.find(c => c.name === 'agenda_cap53_usuarios').id,
                            maxSelect: 1
                        }
                    },
                    {
                        name: 'content',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'read',
                        type: 'bool',
                        defaultValue: false
                    }
                ],
                listRule: '@request.auth.id != "" && (sender = @request.auth.id || receiver = @request.auth.id)',
                viewRule: '@request.auth.id != "" && (sender = @request.auth.id || receiver = @request.auth.id)',
                createRule: '@request.auth.id != "" && sender = @request.auth.id',
                updateRule: '@request.auth.id != "" && receiver = @request.auth.id',
                deleteRule: null
            });
            console.log('Collection created successfully');
        } else {
            console.log('Collection agenda_cap53_mensagens already exists');
        }

    } catch (error) {
        console.error('Error setting up collection:', error);
    }
}

setupMessagesCollection();

