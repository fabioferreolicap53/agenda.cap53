
const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function run() {
    try {
        console.log('Authenticating...');
        const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
        });
        
        if (!authRes.ok) throw new Error(`Auth failed: ${authRes.status}`);
        const authData = await authRes.json();
        const token = authData.token;
        console.log('Authenticated!');

        console.log(`Checking agenda_cap53_itens_servico rules...`);
        const getRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico`, {
            headers: { 'Authorization': `${token}` }
        });
        if (!getRes.ok) throw new Error(`Failed to get collection: ${getRes.status}`);
        
        const collection = await getRes.json();
        console.log('Rules:', {
            listRule: collection.listRule,
            viewRule: collection.viewRule,
            createRule: collection.createRule,
            updateRule: collection.updateRule,
            deleteRule: collection.deleteRule
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();

