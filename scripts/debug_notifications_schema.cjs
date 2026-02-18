
const PocketBase = require('pocketbase/cjs');

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function checkNotificationsSchema() {
    const pb = new PocketBase(PB_URL);

    try {
        console.log(`Connecting to ${PB_URL}...`);
        
        // Authenticate
        try {
            await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('✅ Authenticated as Admin via SDK.');
        } catch (e) {
            console.log('⚠️ SDK Admin auth failed, trying fallback REST...');
            try {
                 const response = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
                 });
                 if (!response.ok) {
                     const errText = await response.text();
                     throw new Error(`Auth failed: ${response.status} ${response.statusText} - ${errText}`);
                 }
                 const data = await response.json();
                 pb.authStore.save(data.token, data.admin);
                 console.log('✅ Authenticated via REST fallback.');
            } catch (restErr) {
                 console.error('❌ Authentication failed:', restErr.message);
                 return;
            }
        }
        
        const collectionName = 'agenda_cap53_notifications';
        try {
            const collection = await pb.collections.getOne(collectionName);
            
            console.log(`\n📦 Collection: ${collection.name} (${collection.id})`);
            console.log(`Type: ${collection.type}`);
            
            console.log('\n🔒 API Rules:');
            console.log(`   List:   ${collection.listRule || '🚫 (Admin only)'}`);
            console.log(`   View:   ${collection.viewRule || '🚫 (Admin only)'}`);
            console.log(`   Create: ${collection.createRule || '🚫 (Admin only)'}`);
            console.log(`   Update: ${collection.updateRule || '🚫 (Admin only)'}`);
            console.log(`   Delete: ${collection.deleteRule || '🚫 (Admin only)'}`);
            
            console.log('\n📝 Schema Fields:');
            collection.schema.forEach(field => {
                console.log(`   - ${field.name.padEnd(20)} [${field.type}] ${field.required ? '(Required)' : ''}`);
                // Print options for Select/Relation fields if available
                if (field.options) {
                    console.log(`     Options: ${JSON.stringify(field.options)}`);
                }
            });

        } catch (err) {
            console.error(`❌ Error fetching collection '${collectionName}':`, err.message);
        }

    } catch (err) {
        console.error("❌ General Error:", err.message);
    }
}

checkNotificationsSchema();
