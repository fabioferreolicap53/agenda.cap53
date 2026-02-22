import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

(async () => {
    try {
        console.log('Authenticating...');
        const endpoints = ['/api/superusers/auth-with-password', '/api/admins/auth-with-password'];
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
                    break;
                }
            } catch (e) { }
        }

        if (!pb.authStore.isValid) {
            console.error('Auth failed');
            return;
        }

        const collections = ['users', 'agenda_eventos'];
        const results = [];

        const allCollections = await pb.collections.getFullList();

        for (const name of collections) {
            const col = allCollections.find(c => c.name === name);
            if (col) {
                results.push({
                    Name: col.name,
                    ListRule: col.listRule,
                    CreateRule: col.createRule,
                    Fields: col.schema.map(f => `${f.name}(${f.type})`).join(', ')
                });
            } else {
                results.push({ Name: name, Error: 'Not Found in FullList' });
            }
        }

        console.table(results);

    } catch (e) {
        console.error(e);
    }
})();

