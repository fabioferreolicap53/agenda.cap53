import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

async function setupEventChats() {
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

        // 1. Create Salas de Bate-papo collection
        const chatRoomsName = 'agenda_cap53_salas_batepapo';
        let chatRoomsCol = collections.find(c => c.name === chatRoomsName);

        if (!chatRoomsCol) {
            console.log(`Creating ${chatRoomsName} collection...`);
            // Rules: Only event participants or creator or privileged roles can view/create
            const privilegedRolesRule = '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC" || @request.auth.role = "TRA" || @request.auth.role = "CE" || @request.auth.role = "DCA"';
            const roomRule = `@request.auth.id != "" && (event.participants.id ?= @request.auth.id || event.user = @request.auth.id || ${privilegedRolesRule})`;

            chatRoomsCol = await pb.collections.create({
                name: chatRoomsName,
                type: 'base',
                schema: [
                    {
                        name: 'event',
                        type: 'relation',
                        required: true,
                        unique: true,
                        options: {
                            collectionId: eventsCol.id,
                            maxSelect: 1,
                            cascadeDelete: true
                        }
                    },
                    {
                        name: 'created_by',
                        type: 'relation',
                        required: true,
                        options: {
                            collectionId: usersCol.id,
                            maxSelect: 1
                        }
                    },
                    {
                        name: 'status',
                        type: 'select',
                        required: true,
                        options: {
                            values: ['active', 'inactive'],
                            maxSelect: 1
                        }
                    }
                ],
                listRule: roomRule,
                viewRule: roomRule,
                createRule: roomRule,
                updateRule: roomRule,
                deleteRule: '@request.auth.id != "" && (event.user = @request.auth.id || @request.auth.role = "ADMIN")'
            });
            console.log(`${chatRoomsName} created successfully`);
        }

        // 2. Create Mensagens das Salas collection
        const chatMessagesName = 'agenda_cap53_mensagens_salas';
        let chatMessagesCol = collections.find(c => c.name === chatMessagesName);

        if (!chatMessagesCol) {
            console.log(`Creating ${chatMessagesName} collection...`);
            // Rules: Only room participants or privileged roles can view/create
            const privilegedRolesRule = '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC" || @request.auth.role = "TRA" || @request.auth.role = "CE" || @request.auth.role = "DCA"';
            const messageViewRule = `@request.auth.id != "" && (room.event.participants.id ?= @request.auth.id || room.event.user = @request.auth.id || ${privilegedRolesRule})`;
            const messageCreateRule = `@request.auth.id != "" && sender = @request.auth.id && (room.event.participants.id ?= @request.auth.id || room.event.user = @request.auth.id || ${privilegedRolesRule})`;

            chatMessagesCol = await pb.collections.create({
                name: chatMessagesName,
                type: 'base',
                schema: [
                    {
                        name: 'room',
                        type: 'relation',
                        required: true,
                        options: {
                            collectionId: chatRoomsCol.id,
                            maxSelect: 1,
                            cascadeDelete: true
                        }
                    },
                    {
                        name: 'sender',
                        type: 'relation',
                        required: true,
                        options: {
                            collectionId: usersCol.id,
                            maxSelect: 1
                        }
                    },
                    {
                        name: 'content',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'is_edited',
                        type: 'bool',
                        defaultValue: false
                    },
                    {
                        name: 'is_deleted',
                        type: 'bool',
                        defaultValue: false
                    }
                ],
                listRule: messageViewRule,
                viewRule: messageViewRule,
                createRule: messageCreateRule,
                updateRule: '@request.auth.id != "" && sender = @request.auth.id',
                deleteRule: '@request.auth.id != "" && sender = @request.auth.id'
            });
            console.log(`${chatMessagesName} created successfully`);
        }

    } catch (error) {
        console.error('Error setting up event chats:', error);
    }
}

setupEventChats();
