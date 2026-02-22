async function testAuth() {
    const baseUrl = 'https://centraldedados.dev.br';
    const email = 'fabioferreoli@gmail.com';
    const password = '@Cap5364125';

    const endpoints = [
        `${baseUrl}/api/admins/auth-with-password`,
        `${baseUrl}/api/collections/_pb_admins_/auth-with-password`
    ];

    for (const url of endpoints) {
        console.log('\nTesting endpoint:', url);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: email, password })
            });
            console.log('Status:', res.status);
            const data = await res.json();
            if (res.ok) {
                console.log('SUCCESS!');
                // console.log('Data:', JSON.stringify(data, null, 2));
                return;
            } else {
                console.log('Error Data:', JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error('Fetch Error:', e.message);
        }
    }
}

testAuth();

