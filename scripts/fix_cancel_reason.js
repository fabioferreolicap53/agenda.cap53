
const pbUrl = 'https://centraldedados.dev.br';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';

async function setup() {
    console.log('--- Fixing cancel_reason field in agenda_cap53_eventos ---');

    try {
        // Authenticate
        let authData;
        console.log('Authenticating...');

        const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });

        if (authResponse.ok) {
            authData = await authResponse.json();
        } else {
            const superUserResponse = await fetch(`${pbUrl}/api/superusers/auth-with-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: adminEmail, password: adminPass })
            });
            if (superUserResponse.ok) {
                authData = await superUserResponse.json();
            } else {
                throw new Error('Authentication failed.');
            }
        }

        const token = authData.token;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token
        };

        // Get collection schema
        console.log('Fetching collection schema...');
        const res = await fetch(`${pbUrl}/api/collections/agenda_cap53_eventos`, { headers });
        if (!res.ok) throw new Error('Collection agenda_cap53_eventos not found');
        
        const collection = await res.json();
        const schema = collection.schema;

        // Check if cancel_reason exists
        const hasField = schema.find(f => f.name === 'cancel_reason');
        
        if (hasField) {
            console.log('Field "cancel_reason" already exists.');
        } else {
            console.log('Field "cancel_reason" missing. Adding it...');
            schema.push({
                name: 'cancel_reason',
                type: 'text',
                required: false,
                options: {}
            });

            const updateRes = await fetch(`${pbUrl}/api/collections/agenda_cap53_eventos`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ schema })
            });

            if (!updateRes.ok) {
                const err = await updateRes.json();
                console.error('Error adding field:', JSON.stringify(err, null, 2));
            } else {
                console.log('Field "cancel_reason" added successfully.');
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

setup();
