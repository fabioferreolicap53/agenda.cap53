
const pbUrl = 'https://centraldedados.dev.br';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';

async function checkSettings() {
    console.log('--- Checking PocketBase Mail Settings ---');

    try {
        // 1. Authenticate as Admin
        const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });
        
        if (!authResponse.ok) {
            throw new Error(`Admin auth failed: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const token = authData.token;

        // 2. Fetch Settings
        const settingsResponse = await fetch(`${pbUrl}/api/settings`, {
            method: 'GET',
            headers: { 
                'Authorization': token 
            }
        });

        if (!settingsResponse.ok) {
            throw new Error(`Failed to fetch settings: ${settingsResponse.status}`);
        }

        const settings = await settingsResponse.json();
        console.log('Current Meta Settings:', JSON.stringify(settings.meta, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

checkSettings();
