
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// Login as admin to ensure we can delete everything
const ADMIN_EMAIL = 'admin@admin.com'; // Adjust if necessary
const ADMIN_PASS = '1234567890'; // Adjust if necessary

async function clearNotifications() {
    console.log('🧹 Clearing all notifications...');
    try {
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
        
        while (true) {
            // Always fetch the first page because deleting shifts the items
            const result = await pb.collection('agenda_cap53_notifications').getList(1, 50);
            if (result.items.length === 0) break;
            
            console.log(`Deleting batch of ${result.items.length}...`);
            for (const n of result.items) {
                try {
                    await pb.collection('agenda_cap53_notifications').delete(n.id);
                } catch (e) {
                    console.error(`Failed to delete ${n.id}:`, e.message);
                }
            }
        }
        console.log('\n✅ All notifications cleared.');
    } catch (error) {
        console.error('❌ Error clearing notifications:', error);
    }
}

clearNotifications();
