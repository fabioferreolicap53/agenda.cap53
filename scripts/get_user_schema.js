import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

async function getSchema() {
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
                    break;
                }
            } catch (e) { }
        }

        if (!authenticated) {
            console.error('Auth Failed');
            return;
        }

        const collection = await pb.collections.getOne('agenda_cap53_usuarios');
        console.log(JSON.stringify(collection.schema, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

getSchema();

