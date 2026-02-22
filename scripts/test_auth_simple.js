
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function tryAuth() {
    // Teste 1: Rota Admin Legado via fetch
    try {
        console.log('Tentando rota /api/admins/auth-with-password...');
        const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
        });
        if (res.ok) {
            console.log('✅ Sucesso na rota Admin Legado!');
            const data = await res.json();
            return { token: data.token, type: 'admin' };
        } else {
            console.log(`❌ Falha Admin Legado: ${res.status}`);
        }
    } catch (e) { console.error(e.message); }

    // Teste 2: Rota Superuser via fetch
    try {
        console.log('Tentando rota /api/collections/_superusers/auth-with-password...');
        const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
        });
        if (res.ok) {
            console.log('✅ Sucesso na rota Superuser!');
            const data = await res.json();
            return { token: data.token, type: 'superuser' };
        } else {
            console.log(`❌ Falha Superuser: ${res.status}`);
        }
    } catch (e) { console.error(e.message); }
    
    return null;
}

tryAuth();
