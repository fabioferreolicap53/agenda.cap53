
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

        const collectionsToUpdate = [
            {
                name: 'agenda_cap53_itens_servico',
                newFields: [
                    { name: 'is_available', type: 'bool' },
                    { name: 'unit', type: 'text' }
                ]
            },
            {
                name: 'agenda_cap53_almac_requests',
                newFields: [
                    { name: 'item_snapshot_available', type: 'bool' }
                ]
            }
        ];

        for (const target of collectionsToUpdate) {
            console.log(`Processing ${target.name}...`);
            
            // Get current collection
            const getRes = await fetch(`${PB_URL}/api/collections/${target.name}`, {
                headers: { 'Authorization': `${token}` }
            });
            if (!getRes.ok) {
                console.error(`Failed to get ${target.name}: ${getRes.status}`);
                continue;
            }
            const collection = await getRes.json();
            
            let updated = false;
            const schema = [...collection.schema];
            
            for (const field of target.newFields) {
                if (!schema.find(f => f.name === field.name)) {
                    console.log(`Adding ${field.name}...`);
                    schema.push({
                        id: Math.random().toString(36).substring(2, 10),
                        name: field.name,
                        type: field.type,
                        system: false,
                        required: false,
                        options: {}
                    });
                    updated = true;
                }
            }
            
            if (updated) {
                const patchRes = await fetch(`${PB_URL}/api/collections/${collection.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ schema })
                });
                if (patchRes.ok) {
                    console.log(`${target.name} updated successfully!`);
                } else {
                    const errorData = await patchRes.json();
                    console.error(`Failed to update ${target.name}:`, JSON.stringify(errorData));
                }
            } else {
                console.log(`${target.name} already up to date.`);
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();

