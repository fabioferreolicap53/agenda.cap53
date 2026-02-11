
import PocketBase from 'pocketbase';

async function testConflict() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');

    try {
        console.log('1. Logging in as mock user...');
        const authData = await pb.collection('agenda_cap53_usuarios').authWithPassword('admin@cap53.com', 'password123');
        const user = authData.record;
        console.log(`Logged in as: ${user.name} (${user.id})`);

        console.log('2. Attempting a combined update (Bio + Status)...');
        try {
            const updated = await pb.collection('agenda_cap53_usuarios').update(user.id, {
                role: user.role,
                status: 'Ocupado',
                observations: 'Conflict test ' + new Date().getTime()
            });
            console.log('Combined update successful:', updated.status, updated.observations);
        } catch (e) {
            console.error('Combined update FAILED:', JSON.stringify(e.data || e.message, null, 2));
        }

        console.log('3. Attempting rapid sequential updates...');
        try {
            const p1 = pb.collection('agenda_cap53_usuarios').update(user.id, { status: 'Online' });
            const p2 = pb.collection('agenda_cap53_usuarios').update(user.id, { observations: 'Rapid seq ' + new Date().getTime() });
            const results = await Promise.all([p1, p2]);
            console.log('Sequential updates successful:', results.map(r => r.status));
        } catch (e) {
            console.error('Sequential updates FAILED:', JSON.stringify(e.data || e.message, null, 2));
        }

    } catch (err) {
        console.error('CRITICAL Error:', err.message);
    }
}

testConflict();
