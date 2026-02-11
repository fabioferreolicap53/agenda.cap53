
import PocketBase from 'pocketbase';

async function checkCollection() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');

    try {
        console.log('1. Fetching collection metadata directly...');
        // We can try to get it without admin if we know the name and it's public (unlikely for schema)
        // Better: try admin login again but with raw fetch to see what happens
        const res = await fetch('https://centraldedados.duckdns.org/api/admins/auth-with-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: 'fabioferreoli@gmail.com', password: '@Cap5364125' })
        });

        console.log('Response Status:', res.status);
        if (res.ok) {
            const data = await res.json();
            const token = data.token;
            console.log('Admin login successful.');

            const colRes = await fetch('https://centraldedados.duckdns.org/api/collections/agenda_cap53_usuarios', {
                headers: { 'Authorization': token }
            });
            const colMetadata = await colRes.json();
            console.log('Collection Metadata:', JSON.stringify(colMetadata, null, 2));
        } else {
            const errData = await res.text();
            console.log('Admin login FAILED:', errData);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkCollection();
