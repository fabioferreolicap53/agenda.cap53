
const pbUrl = 'https://centraldedados.duckdns.org';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';

async function check() {
    try {
        const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });
        const token = (await authResponse.json()).token;
        
        const res = await fetch(`${pbUrl}/api/collections/agenda_cap53_eventos`, {
            headers: { 'Authorization': token }
        });
        const col = await res.json();
        
        const field = col.schema.find(f => f.name === 'participants_status');
        console.log('Has participants_status:', !!field);
        if (field) console.log('Field definition:', field);
        else {
            console.log('All fields:', col.schema.map(f => f.name));
        }

    } catch (e) {
        console.error(e);
    }
}

check();
