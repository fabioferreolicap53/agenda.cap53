
import PocketBase from 'pocketbase';

async function test() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');
    try {
        console.log('Testing user auth...');
        // Using credentials from verify_pb_data.js as regular user
        await pb.collection('agenda_cap53_usuarios').authWithPassword('fabioferreoli@gmail.com', '@Cap5364125');
        console.log('Auth successful!');

        const collections = await pb.collections.getFullList();
        console.log('Collections found:', collections.map(c => c.name));

        const users = await pb.collection('agenda_cap53_usuarios').getFullList();
        console.log('Users found:', users.length);
        users.forEach(u => console.log(`- ${u.name} (${u.email}) role=${u.role} sector=${u.sector}`));

        const locations = await pb.collection('agenda_cap53_locais').getFullList();
        console.log('Locations found:', locations.length);
        locations.forEach(l => console.log(`- ${l.name} available=${l.is_available}`));

    } catch (e) {
        console.error('Test failed:', e.message);
        if (e.data) console.error('Data:', JSON.stringify(e.data, null, 2));
    }
}

test();
