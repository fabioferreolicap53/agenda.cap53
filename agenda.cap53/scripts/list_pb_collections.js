
const PocketBase = require('pocketbase/cjs');

async function listCollections() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');

    try {
        // Authenticate - assuming admin credentials are required or there's a specific user
        // But since we want to check PUBLIC visibility/rules, let's just try to list
        console.log('Fetching collections...');
        const collections = await pb.collections.getFullList();
        console.log('Collections found:');
        collections.forEach(c => console.log(`- ${c.name} (${c.type})`));
    } catch (err) {
        console.error('Error fetching collections:', err.message);
        if (err.data) console.error('Error data:', JSON.stringify(err.data, null, 2));
    }
}

listCollections();
