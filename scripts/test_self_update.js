
import PocketBase from 'pocketbase';

async function testSelfUpdate() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');

    try {
        console.log('1. Logging in as mock user...');
        // We know mock users from setup: admin@cap53.com / password123
        const authData = await pb.collection('agenda_cap53_usuarios').authWithPassword('admin@cap53.com', 'password123');
        const user = authData.record;
        console.log(`Logged in as: ${user.name} (${user.id})`);

        console.log('2. Trying to update status to "Ocupado"...');
        try {
            const updated = await pb.collection('agenda_cap53_usuarios').update(user.id, {
                status: 'Ocupado'
            });
            console.log('Status update successful:', updated.status);
        } catch (e) {
            console.error('Status update FAILED:', JSON.stringify(e.data || e.message, null, 2));
        }

        console.log('3. Trying to update bio...');
        try {
            const updatedBio = await pb.collection('agenda_cap53_usuarios').update(user.id, {
                observations: 'Self test ' + new Date().getTime()
            });
            console.log('Bio update successful.');
        } catch (e) {
            console.error('Bio update FAILED:', JSON.stringify(e.data || e.message, null, 2));
        }

        console.log('4. Trying to update email (should fail if manageRule is null)...');
        try {
            const updatedEmail = await pb.collection('agenda_cap53_usuarios').update(user.id, {
                email: 'admin_NEW@cap53.com'
            });
            console.log('Email update successful (UNEXPECTED if manageRule null):', updatedEmail.email);
        } catch (e) {
            console.error('Email update FAILED (EXPECTED):', JSON.stringify(e.data || e.message, null, 2));
        }

    } catch (err) {
        console.error('CRITICAL Error:', err.message);
    }
}

testSelfUpdate();
