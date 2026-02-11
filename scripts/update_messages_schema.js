import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

async function updateMessagesCollection() {
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
        const messagesCollection = collections.find(c => c.name === 'agenda_cap53_mensagens');

        if (messagesCollection) {
            console.log('Updating agenda_cap53_mensagens collection rules and schema...');
            
            const schema = messagesCollection.schema;
            
            // Make content not required so we can send files without text
            const contentField = schema.find(f => f.name === 'content');
            if (contentField) {
                contentField.required = false;
            }

            const hasEdited = schema.some(f => f.name === 'is_edited');
            const hasDeleted = schema.some(f => f.name === 'is_deleted');
            const hasDeletedBySender = schema.some(f => f.name === 'deleted_by_sender');
            const hasDeletedByReceiver = schema.some(f => f.name === 'deleted_by_receiver');
            const hasFile = schema.some(f => f.name === 'file');

            const newSchema = [...schema];
            if (!hasEdited) {
                newSchema.push({
                    name: 'is_edited',
                    type: 'bool',
                    defaultValue: false
                });
            }
            if (!hasDeleted) {
                newSchema.push({
                    name: 'is_deleted',
                    type: 'bool',
                    defaultValue: false
                });
            }
            if (!hasDeletedBySender) {
                newSchema.push({
                    name: 'deleted_by_sender',
                    type: 'bool',
                    defaultValue: false
                });
            }
            if (!hasDeletedByReceiver) {
                newSchema.push({
                    name: 'deleted_by_receiver',
                    type: 'bool',
                    defaultValue: false
                });
            }
            if (!hasFile) {
                newSchema.push({
                    name: 'file',
                    type: 'file',
                    options: {
                        maxSelect: 1,
                        maxSize: 5242880, // 5MB
                        mimeTypes: [],
                        thumbs: ['100x100']
                    }
                });
            }

            // Update rules: sender can update their own message, receiver can update (for marking as read)
            await pb.collections.update(messagesCollection.id, {
                schema: newSchema,
                createRule: '@request.auth.id != "" && sender = @request.auth.id',
                updateRule: '@request.auth.id != "" && (sender = @request.auth.id || receiver = @request.auth.id)',
                deleteRule: '@request.auth.id != "" && (sender = @request.auth.id || receiver = @request.auth.id)'
            });
            console.log('Collection updated successfully');
        } else {
            console.log('Collection agenda_cap53_mensagens not found');
        }

    } catch (error) {
        console.error('Error updating collection:', error);
    }
}

updateMessagesCollection();
