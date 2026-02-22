async function cleanupLocais() {
    const baseUrl = 'https://centraldedados.dev.br';
    const email = 'fabioferreoli@gmail.com';
    const password = '@Cap5364125';
    const PREFIX = 'agenda_cap53_';

    try {
        console.log('--- Cleaning Up Locais ---');

        const authRes = await fetch(`${baseUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password })
        });
        const authData = await authRes.json();
        const token = authData.token;
        const headers = { 'Authorization': token, 'Content-Type': 'application/json' };

        const recRes = await fetch(`${baseUrl}/api/collections/${PREFIX}locais/records`, { headers });
        const recData = await recRes.json();

        for (const r of recData.items) {
            if (!r.name) {
                console.log(`Deleting empty record: ${r.id}`);
                await fetch(`${baseUrl}/api/collections/${PREFIX}locais/records/${r.id}`, {
                    method: 'DELETE',
                    headers
                });
            }
        }
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

cleanupLocais();

