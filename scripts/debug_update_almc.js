
const PB_URL = 'https://centraldedados.dev.br';

async function run() {
    try {
        console.log('Starting debug update script for ALMC user...');
        
        // 1. Authenticate first
        const email = 'almac@cap53.com';
        const password = 'password123';
        
        console.log(`Authenticating as ${email}...`);
        const authRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_usuarios/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password: password })
        });
        
        if (!authRes.ok) throw new Error(`Auth failed: ${authRes.status}`);
        const authData = await authRes.json();
        const token = authData.token;
        console.log('Authenticated! Role:', authData.record.role);

        // 2. Fetch an item that ALMC can manage (category ALMOXARIFADO or COPA)
        console.log('Fetching an item (ALMOXARIFADO or COPA) to test...');
        const res = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico/records?filter=(category="ALMOXARIFADO"||category="COPA")&limit=1`, {
            headers: { 'Authorization': `${token}` }
        });
        const data = await res.json();
        
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            const itemId = item.id;
            const newStatus = !item.is_available;
            
            console.log(`Testing with item: ${item.name} (${itemId}) - Category: ${item.category} - Current: ${item.is_available}`);
            
            // 3. Update the item
            console.log(`Updating item ${itemId} to is_available: ${newStatus}...`);
            const updateRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico/records/${itemId}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_available: newStatus })
            });

            if (!updateRes.ok) {
                const err = await updateRes.json();
                throw new Error(`Update failed: ${updateRes.status} - ${JSON.stringify(err)}`);
            }
            
            const updated = await updateRes.json();
            console.log('Update Successful! Response is_available:', updated.is_available);

            // 4. Verify with a fresh GET
            const getRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico/records/${itemId}`, {
                headers: { 'Authorization': `${token}` }
            });
            const verified = await getRes.json();
            console.log('Fresh GET verification is_available:', verified.is_available);
            
            // 5. Revert back
            console.log('Reverting back...');
            await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico/records/${itemId}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_available: !newStatus })
            });
            console.log('Reverted.');

        } else {
            console.log('No ALMOXARIFADO/COPA items found.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();

