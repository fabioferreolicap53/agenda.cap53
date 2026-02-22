
import PocketBase from 'pocketbase';

// Configuration extracted from other project scripts
const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function checkRules() {
    const pb = new PocketBase(PB_URL);

    try {
        console.log(`Connecting to ${PB_URL}...`);
        
        // Attempt authentication
        try {
            await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('Authenticated as Admin.');
        } catch (e) {
            console.log('Admin auth failed, trying superuser...');
            try {
                await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
                console.log('Authenticated as Superuser.');
            } catch (superErr) {
                console.error('Authentication failed:', superErr.message);
                return;
            }
        }
        
        const collectionName = 'agenda_cap53_notifications';
        try {
            const collection = await pb.collections.getOne(collectionName);
            
            console.log(`\n--- Collection: ${collectionName} ---`);
            console.log(`ID: ${collection.id}`);
            console.log(`Type: ${collection.type}`);
            console.log('--- API Rules ---');
            console.log(`List Rule:   ${collection.listRule || 'null (Admin only)'}`);
            console.log(`View Rule:   ${collection.viewRule || 'null (Admin only)'}`);
            console.log(`Create Rule: ${collection.createRule || 'null (Admin only)'}`);
            console.log(`Update Rule: ${collection.updateRule || 'null (Admin only)'}`);
            console.log(`Delete Rule: ${collection.deleteRule || 'null (Admin only)'}`);
            
            console.log('\n--- Schema ---');
            console.table(collection.schema.map(f => ({ 
                name: f.name, 
                type: f.type, 
                required: f.required 
            })));

        } catch (err) {
            if (err.status === 404) {
                console.log(`Collection '${collectionName}' not found.`);
            } else {
                throw err;
            }
        }

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkRules();

