
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function tryAuth() {
    const pb = new PocketBase(PB_URL);
    const endpoints = [
        '/api/admins/auth-with-password',
        '/api/superusers/auth-with-password',
        '/api/collections/_superusers/auth-with-password'
    ];

    for (const ep of endpoints) {
        try {
            console.log(`Trying ${ep}...`);
            const res = await fetch(`${PB_URL}${ep}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: ADMIN_EMAIL, email: ADMIN_EMAIL, password: ADMIN_PASS })
            });
            console.log(`Status: ${res.status}`);
            const data = await res.json();
            if (res.ok) {
                console.log(`SUCCESS on ${ep}!`);
                console.log('Token prefix:', data.token.substring(0, 10));
                return;
            } else {
                console.log(`Failed ${ep}:`, JSON.stringify(data));
            }
        } catch (e) {
            console.log(`Error ${ep}:`, e.message);
        }
    }
}

tryAuth();
