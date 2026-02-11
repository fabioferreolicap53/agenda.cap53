
import PocketBase from 'pocketbase';

async function checkCollection() {
    try {
        console.log('Fetching collection metadata for agenda_cap53_notifications...');
        const res = await fetch('https://centraldedados.duckdns.org/api/admins/auth-with-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: 'fabioferreoli@gmail.com', password: '@Cap5364125' })
        });

        if (res.ok) {
            const data = await res.json();
            const token = data.token;
            console.log('Admin login successful.');

            const colRes = await fetch('https://centraldedados.duckdns.org/api/collections/agenda_cap53_notifications', {
                headers: { 'Authorization': token }
            });
            const colMetadata = await colRes.json();
            console.log('Collection Metadata:', JSON.stringify(colMetadata, null, 2));
        } else {
            console.log('Admin login FAILED:', await res.text());
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkCollection();
