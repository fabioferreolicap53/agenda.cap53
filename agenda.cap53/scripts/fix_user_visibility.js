import PocketBase from 'pocketbase';

async function updateRules() {
    const PB_URL = 'https://centraldedados.duckdns.org';
    const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
    const ADMIN_PASS = '@Cap5364125';

    const pb = new PocketBase(PB_URL);

    try {
        // Authenticate (Robust method from list_collections.js)
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
                    pb.authStore.save(data.token, data.record || data.admin || data.superuser);
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

        // Find collection by name
        const collections = await pb.collections.getFullList();
        const collection = collections.find(c => c.name === 'agenda_cap53_usuarios');

        if (!collection) {
            console.error('ERROR: Collection agenda_cap53_usuarios not found!');
            return;
        }

        console.log(`Found collection: ${collection.name} (${collection.id})`);

        // Update Usuarios collection rules
        await pb.collections.update(collection.id, {
            ...collection,
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
        });
        console.log('Updated agenda_cap53_usuarios rules: all authenticated users can now see the team list.');

    } catch (error) {
        console.error('Error updating rules:', error.data || error.message || error);
    }
}

updateRules();
