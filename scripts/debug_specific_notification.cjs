
const PocketBase = require('pocketbase/cjs');

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';
const TARGET_ID = '5hi3h9w2w8oqqa8';

async function inspectNotification() {
    const pb = new PocketBase(PB_URL);

    try {
        // Authenticate
        try {
            await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
        } catch (e) {
             const response = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
             });
             const data = await response.json();
             pb.authStore.save(data.token, data.admin);
        }
        
        console.log(`\n🔍 Inspecting Notification ID: ${TARGET_ID}`);
        
        try {
            const record = await pb.collection('agenda_cap53_notifications').getOne(TARGET_ID);
            console.log(JSON.stringify(record, null, 2));
            
            // Try to perform a test update to reproduce the error
            console.log('\n🧪 Attempting test update (dry run)...');
            try {
                // We use the admin client, so permissions shouldn't be an issue unless it's a validation error
                await pb.collection('agenda_cap53_notifications').update(TARGET_ID, { read: true });
                console.log('✅ Update success (Admin context)');
            } catch (upErr) {
                console.error('❌ Update failed:', upErr.response || upErr.message);
            }
            
        } catch (err) {
            console.error(`❌ Error fetching record:`, err.message);
        }

    } catch (err) {
        console.error("❌ General Error:", err.message);
    }
}

inspectNotification();
