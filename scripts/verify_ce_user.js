async function verifyUser() {
    const baseUrl = 'https://centraldedados.duckdns.org';
    const email = 'fabioferreoli@gmail.com';
    const password = '@Cap5364125';
    const PREFIX = 'agenda_cap53_';

    try {
        console.log('--- Verifying Users ---');

        const authRes = await fetch(`${baseUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password })
        });
        const authData = await authRes.json();
        const headers = { 'Authorization': authData.token };

        const usersRes = await fetch(`${baseUrl}/api/collections/${PREFIX}usuarios/records`, { headers });
        const usersData = await usersRes.json();

        console.log('\nUsers Found:', usersData.totalItems);
        usersData.items.forEach(u => {
            console.log(`- Email: ${u.email}, Role: "${u.role}", ID: ${u.id}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

verifyUser();
