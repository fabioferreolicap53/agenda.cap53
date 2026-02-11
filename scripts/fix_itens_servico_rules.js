
async function fixItensServicoRules() {
    const PB_URL = 'https://centraldedados.duckdns.org';
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

    console.log('Updating API rules...');
    const newRule = '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC" || @request.auth.role = "DCA"';
    
    collection.createRule = newRule;
    collection.updateRule = newRule;
    collection.deleteRule = newRule;

    const updateRes = await fetch(`${PB_URL}/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            createRule: collection.createRule,
            updateRule: collection.updateRule,
            deleteRule: collection.deleteRule
        })
    });

    if (updateRes.ok) {
        console.log('Rules updated successfully! Now DCA users can manage informatics items.');
    } else {
        console.error('Failed to update rules:', await updateRes.text());
    }
}

fixItensServicoRules();
