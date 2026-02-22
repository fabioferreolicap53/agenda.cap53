
const PocketBase = require('pocketbase/cjs');

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function checkNotificationsSchema() {
    const pb = new PocketBase(PB_URL);

    try {
        console.log(`Connecting to ${PB_URL}...`);
        
        // Authenticate
        try {
            await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('âœ… Authenticated as Admin via SDK.');
        } catch (e) {
            console.log('âš ï¸ SDK Admin auth failed, trying fallback REST...');
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
                 console.log('âœ… Authenticated via REST fallback.');
            } catch (restErr) {
                 console.error('âŒ Authentication failed:', restErr.message);
                 return;
            }
        }
        
        const collectionName = 'agenda_cap53_notifications';
        try {
            const collection = await pb.collections.getOne(collectionName);
            
            console.log(`\nðŸ“¦ Collection: ${collection.name} (${collection.id})`);
            console.log(`Type: ${collection.type}`);
            
            console.log('\nðŸ”’ API Rules:');
            console.log(`   List:   ${collection.listRule || 'ðŸš« (Admin only)'}`);
            console.log(`   View:   ${collection.viewRule || 'ðŸš« (Admin only)'}`);
            console.log(`   Create: ${collection.createRule || 'ðŸš« (Admin only)'}`);
            console.log(`   Update: ${collection.updateRule || 'ðŸš« (Admin only)'}`);
            console.log(`   Delete: ${collection.deleteRule || 'ðŸš« (Admin only)'}`);
            
            console.log('\nðŸ“ Schema Fields:');
            collection.schema.forEach(field => {
                console.log(`   - ${field.name.padEnd(20)} [${field.type}] ${field.required ? '(Required)' : ''}`);
                // Print options for Select/Relation fields if available
                if (field.options) {
                    console.log(`     Options: ${JSON.stringify(field.options)}`);
                }
            });

        } catch (err) {
            console.error(`âŒ Error fetching collection '${collectionName}':`, err.message);
        }

    } catch (err) {
        console.error("âŒ General Error:", err.message);
    }
}

checkNotificationsSchema();

