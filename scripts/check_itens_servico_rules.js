
async function checkCollection() {
    const PB_URL = 'https://centraldedados.dev.br';
    const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
    const ADMIN_PASS = '@Cap5364125';

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

    console.log('Fetching collection agenda_cap53_itens_servico...');
    const colRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico`, { headers });
    if (!colRes.ok) {
        console.error('Failed to fetch collection');
        return;
    }
    const collection = await colRes.json();

    console.log('Collection Info:');
    console.log('Name:', collection.name);
    console.log('Create Rule:', collection.createRule);
    console.log('Update Rule:', collection.updateRule);
    console.log('Delete Rule:', collection.deleteRule);
    console.log('List Rule:', collection.listRule);
    console.log('View Rule:', collection.viewRule);
    
    console.log('\nSchema:');
    collection.schema.forEach(f => {
        console.log(`- ${f.name} (${f.type})${f.required ? ' REQUIRED' : ''} ${f.options ? JSON.stringify(f.options) : ''}`);
    });
}

checkCollection();

