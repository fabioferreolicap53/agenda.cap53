
const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function checkCollections() {
    console.log('Authenticating...');
    const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
    });

    if (!authRes.ok) {
        console.error('Auth failed');
        return;
    }
    const { token } = await authRes.json();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token
    };

    const collections = ['agenda_cap53_almac_requests', 'agenda_cap53_eventos'];

    for (const name of collections) {
        console.log(`\nFetching collection ${name}...`);
        const colRes = await fetch(`${PB_URL}/api/collections/${name}`, { headers });
        if (!colRes.ok) {
            console.error(`Failed to fetch collection ${name}`);
            continue;
        }
        const collection = await colRes.json();

        console.log(`Collection: ${collection.name}`);
        console.log('Create Rule:', collection.createRule);
        console.log('Update Rule:', collection.updateRule);
        console.log('Delete Rule:', collection.deleteRule);
        console.log('List Rule:', collection.listRule);
        console.log('View Rule:', collection.viewRule);
    }
}

checkCollections();
