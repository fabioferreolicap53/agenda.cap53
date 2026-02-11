
import PocketBase from 'pocketbase';

async function testUpdate() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');

    try {
        console.log('1. Trying to login as admin...');
        await pb.admins.authWithPassword('fabioferreoli@gmail.com', '@Cap5364125');

        console.log('2. Fetching first user...');
        const users = await pb.collection('agenda_cap53_usuarios').getFullList({ perPage: 1 });
        if (users.length === 0) {
            console.log('No users found to test.');
            return;
        }

        const testUser = users[0];
        console.log(`Testing with user: ${testUser.id} (${testUser.email})`);

        console.log('3. Attempting to update status to "Ausente"...');
        try {
            const updated = await pb.collection('agenda_cap53_usuarios').update(testUser.id, {
                status: 'Ausente'
            });
            console.log('Status updated successfully:', updated.status);
        } catch (e) {
            console.error('FAILED to update status:', JSON.stringify(e.data || e.message, null, 2));
        }

        console.log('4. Attempting to update bio...');
        try {
            const updatedBio = await pb.collection('agenda_cap53_usuarios').update(testUser.id, {
                observations: 'Bio update test ' + new Date().toISOString()
            });
            console.log('Bio updated successfully.');
        } catch (e) {
            console.error('FAILED to update bio:', JSON.stringify(e.data || e.message, null, 2));
        }

        console.log('5. Checking if user can update THEMSELVES (simulating browser)...');
        // Clear admin auth
        pb.authStore.clear();

        // Login as the user (using known password from setup)
        try {
            await pb.collection('agenda_cap53_usuarios').authWithPassword(testUser.email, 'password123');
            console.log('Logged in as user successfully.');

            console.log('6. Attempting self-update of name...');
            const selfUpdate = await pb.collection('agenda_cap53_usuarios').update(testUser.id, {
                name: testUser.name + ' (Updated)'
            });
            console.log('Self-update successful:', selfUpdate.name);
        } catch (e) {
            console.error('FAILED self-update:', JSON.stringify(e.data || e.message, null, 2));
        }

    } catch (err) {
        console.error('CRITICAL Error:', err.message);
    }
}

testUpdate();
