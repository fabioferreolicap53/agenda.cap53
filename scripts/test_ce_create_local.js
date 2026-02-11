import PocketBase from 'pocketbase';

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function testCECreate() {
    try {
        console.log('--- Testing Create Local as CE User ---');

        // Login as CE user
        await pb.collection('agenda_cap53_usuarios').authWithPassword('ce@cap53.com', 'password123');
        console.log('Logged in as CE user:', pb.authStore.model.email);
        console.log('Role:', pb.authStore.model.role);

        // Try to create a local
        const name = 'Local Test CE ' + Date.now();
        console.log(`Attempting to create local: "${name}"`);

        const record = await pb.collection('agenda_cap53_locais').create({
            name: name,
            conflict_control: true
        });

        console.log('SUCCESS! Created record:', record.id);

        // Cleanup
        await pb.collection('agenda_cap53_locais').delete(record.id);
        console.log('Test record deleted.');

    } catch (error) {
        console.error('FAILED!');
        console.error('Error Message:', error.message);
        if (error.data) console.error('Error Data:', JSON.stringify(error.data, null, 2));
    }
}

testCECreate();
