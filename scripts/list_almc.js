
const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function run() {
    try {
        const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
        });
        const authData = await authRes.json();
        const token = authData.token;

        const res = await fetch(`${PB_URL}/api/collections/agenda_cap53_usuarios/records?filter=role="ALMC"`, {
            headers: { 'Authorization': `${token}` }
        });
        const data = await res.json();
        console.log('ALMC Users:', data.items.map(u => ({ email: u.email, id: u.id })));
    } catch (e) {
        console.error(e);
    }
}
run();

