const PocketBase = require('pocketbase');
const pb = new PocketBase('https://centraldedados.duckdns.org');

async function check() {
    try {
        await pb.admins.authWithPassword('fabioferreoli@gmail.com', '@Cap5364125');
        const collections = await pb.collections.getFullList();
        console.log('Collections:', collections.map(c => c.name));

        // Check users collection schema
        const usersColl = collections.find(c => c.name === 'users' || c.name === 'debtflow_usuarios');
        if (usersColl) {
            console.log(`Schema for ${usersColl.name}:`, JSON.stringify(usersColl.schema, null, 2));
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

check();
