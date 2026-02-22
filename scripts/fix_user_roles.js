async function fixRoles() {
    const baseUrl = 'https://centraldedados.dev.br';
    const email = 'fabioferreoli@gmail.com';
    const password = '@Cap5364125';
    const PREFIX = 'agenda_cap53_';

    try {
        console.log('--- Fixing User Roles ---');

        const authRes = await fetch(`${baseUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password })
        });
        const authData = await authRes.json();
        const headers = { 'Authorization': authData.token, 'Content-Type': 'application/json' };

        const rolesMap = {
            'admin@cap53.com': 'ADMIN',
            'almac@cap53.com': 'ALMC',
            'tra@cap53.com': 'TRA',
            'ce@cap53.com': 'CE'
        };

        const usersRes = await fetch(`${baseUrl}/api/collections/${PREFIX}usuarios/records`, { headers });
        const usersData = await usersRes.json();

        for (const u of usersData.items) {
            const desiredRole = rolesMap[u.email];
            if (desiredRole && u.role !== desiredRole) {
                console.log(`Updating ${u.email} to role: ${desiredRole}`);
                await fetch(`${baseUrl}/api/collections/${PREFIX}usuarios/records/${u.id}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ role: desiredRole })
                });
            }
        }
        console.log('Roles fixed.');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

fixRoles();

