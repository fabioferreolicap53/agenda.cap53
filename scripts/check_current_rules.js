
const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function checkRules() {
    try {
        const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
        });
        const { token } = await authRes.json();

        const collections = ['agenda_cap53_almac_requests', 'agenda_cap53_eventos'];

        for (const name of collections) {
            const res = await fetch(`${PB_URL}/api/collections/${name}`, {
                headers: { 'Authorization': token }
            });
            const col = await res.json();
            console.log(`\nCollection: ${name}`);
            console.log(`Update Rule: ${col.updateRule}`);
        }

    } catch (e) {
        console.error(e);
    }
}

checkRules();
