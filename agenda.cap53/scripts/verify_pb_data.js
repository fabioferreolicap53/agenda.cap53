
import PocketBase from 'pocketbase';

async function verifyUsers() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');

    try {
        console.log('Authenticating as admin...');
        await pb.admins.authWithPassword('fabioferreoli@gmail.com', '@Cap5364125');

        console.log('Fetching users from agenda_cap53_usuarios...');
        const users = await pb.collection('agenda_cap53_usuarios').getFullList();
        console.log(`Total users found: ${users.length}`);
        users.forEach(u => console.log(`- ${u.name} (${u.email}) [${u.role}]`));

        console.log('\nFetching locations...');
        const locs = await pb.collection('agenda_cap53_locais').getFullList();
        console.log(`Total locations: ${locs.length}`);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

verifyUsers();
