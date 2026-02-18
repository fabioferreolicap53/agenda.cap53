
const PocketBase = require('pocketbase/cjs');

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function fixSchema() {
    const pb = new PocketBase(PB_URL);

    try {
        console.log(`Connecting to ${PB_URL}...`);
        
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
        
        const collectionName = 'agenda_cap53_notifications';
        const collection = await pb.collections.getOne(collectionName);
        
        console.log(`\n📦 Current Schema for 'invite_status':`);
        const field = collection.schema.find(f => f.name === 'invite_status');
        console.log(JSON.stringify(field.options));
        
        // Add missing options
        const currentValues = field.options.values || [];
        const newValues = ['pending', 'accepted', 'rejected', 'confirmed', 'approved'];
        
        // Merge and unique
        const finalValues = [...new Set([...currentValues, ...newValues])];
        
        if (finalValues.length === currentValues.length) {
            console.log('✅ Schema already has all required options.');
            return;
        }
        
        console.log(`\n🔄 Updating schema options to: ${JSON.stringify(finalValues)}`);
        
        field.options.values = finalValues;
        
        await pb.collections.update(collection.id, {
            schema: collection.schema
        });
        
        console.log('✅ Schema updated successfully!');

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

fixSchema();
