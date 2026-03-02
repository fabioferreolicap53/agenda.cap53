
const pbUrl = 'https://centraldedados.dev.br';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';

async function checkStatus() {
    console.log('--- Checking status field options ---');

    // Authenticate
    let authData;
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
            console.error('Auth failed');
            return;
        }
    }

    const token = authData.token;
    const headers = { 'Authorization': token };

    const res = await fetch(`${pbUrl}/api/collections/agenda_cap53_eventos`, { headers });
    const collection = await res.json();
    
    const statusField = collection.schema.find(f => f.name === 'status');
    console.log('Status field:', JSON.stringify(statusField, null, 2));
}

checkStatus();
