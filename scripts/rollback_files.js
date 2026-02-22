import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

async function rollbackFileSupport() {
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
            console.log('Rolling back file support from agenda_cap53_mensagens...');
            
            // Filter out the 'file' field and restore 'content' as required
            const newSchema = messagesCollection.schema.filter(f => f.name !== 'file').map(f => {
                if (f.name === 'content') {
                    return { ...f, required: true };
                }
                return f;
            });

            await pb.collections.update(messagesCollection.id, {
                schema: newSchema
            });
            console.log('Collection schema rolled back successfully (file removed, content required)');
        } else {
            console.log('Collection agenda_cap53_mensagens not found');
        }

    } catch (error) {
        console.error('Error rolling back collection:', error);
    }
}

rollbackFileSupport();

