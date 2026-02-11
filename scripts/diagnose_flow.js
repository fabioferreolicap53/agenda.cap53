import PocketBase from 'pocketbase';

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function diagnose() {
    console.log('--- DIAGNOSTIC START ---');
    try {
        // 1. Login as Admin to inspect everything
        await pb.admins.authWithPassword('admin@admin.com', '1234567890');
        console.log('Auth: OK');

        // 2. Check Users
        const users = await pb.collection('agenda_cap53_usuarios').getFullList();
        const almcUsers = users.filter(u => u.role === 'ALMC');
        console.log(`ALMC Users found: ${almcUsers.length}`);
        if (almcUsers.length === 0) console.error('CRITICAL: No ALMC users found!');

        // 3. Check Collection Rules
        const collections = await pb.collections.getFullList();
        const notifCol = collections.find(c => c.name === 'agenda_cap53_notifications');
        console.log('Notification Rules:', {
            create: notifCol.createRule,
            read: notifCol.listRule,
            update: notifCol.updateRule
        });

        // 4. Check Recent Notifications
        const recentNotifs = await pb.collection('agenda_cap53_notifications').getList(1, 5, {
            sort: '-created',
            expand: 'user'
        });
        console.log('Recent Notifications:');
        recentNotifs.items.forEach(n => {
            console.log(`- [${n.type}] To: ${n.expand?.user?.email} | Title: ${n.title} | Ack: ${n.acknowledged}`);
        });

    } catch (e) {
        console.error('DIAGNOSTIC ERROR:', e);
    }
}

diagnose();
