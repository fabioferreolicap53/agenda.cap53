
async function debug() {
    const PB_URL = 'https://centraldedados.duckdns.org';
    const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
    const ADMIN_PASS = '@Cap5364125';

    console.log('Testing raw fetch to /api/admins/auth-with-password...');
    const res1 = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
    });
    console.log('Admins API status:', res1.status);
    if (res1.ok) {
        console.log('Admins API works!');
        const data = await res1.json();
        const token = data.token;
        
        console.log('\nFetching agenda_cap53_itens_servico schema...');
        const res3 = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico`, {
            headers: { 'Authorization': token }
        });
        if (res3.ok) {
            const col = await res3.json();
            console.log(JSON.stringify(col, null, 2));
        } else {
            console.log('Failed to fetch collection:', await res3.text());
        }
    } else {
        console.log('Admins API failed:', await res1.text());
    }

    console.log('\nTesting raw fetch to /api/collections/_superusers/auth-with-password...');
    const res2 = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
    });
    console.log('Superusers API status:', res2.status);
    if (res2.ok) {
        console.log('Superusers API works!');
        const data = await res2.json();
        const token = data.token;
        
        console.log('\nFetching agenda_cap53_itens_servico schema...');
        const res3 = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico`, {
            headers: { 'Authorization': token }
        });
        if (res3.ok) {
            const col = await res3.json();
            console.log(JSON.stringify(col, null, 2));
        } else {
            console.log('Failed to fetch collection:', await res3.text());
        }
    } else {
        console.log('Superusers API failed:', await res2.text());
    }
}

debug();
