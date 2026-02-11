
async function fixSchema() {
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

    console.log('Fetching collection...');
    const colRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico`, { headers });
    const collection = await colRes.json();

    console.log('Updating schema...');
    const schema = collection.schema;

    // 1. Ensure 'is_available' exists
    if (!schema.find(f => f.name === 'is_available')) {
        schema.push({
            name: 'is_available',
            type: 'bool',
            required: false
        });
    }

    // 2. Ensure 'unit' exists and has a name
    const unitField = schema.find(f => f.id === '5ucbt2ur' || f.name === 'unit');
    if (unitField) {
        unitField.name = 'unit';
    } else {
        schema.push({
            name: 'unit',
            type: 'text',
            required: false
        });
    }

    // 3. Add 'INFORMATICA' to category
    const categoryField = schema.find(f => f.name === 'category');
    if (categoryField && categoryField.options && categoryField.options.values) {
        if (!categoryField.options.values.includes('INFORMATICA')) {
            categoryField.options.values.push('INFORMATICA');
        }
    }

    console.log('Sending PATCH request...');
    const updateRes = await fetch(`${PB_URL}/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ schema })
    });

    if (updateRes.ok) {
        console.log('Schema updated successfully!');
    } else {
        console.error('Failed to update schema:', await updateRes.text());
    }
}

fixSchema();
