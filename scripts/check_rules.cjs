
const PocketBase = require('pocketbase/cjs');

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
            console.log('SDK Admin auth failed, trying fallback REST...');
            try {
                 const response = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
                 });
                 if (!response.ok) throw new Error("Auth failed");
                 const data = await response.json();
                 pb.authStore.save(data.token, data.admin);
                 console.log('Authenticated via REST fallback.');
            } catch (restErr) {
                 console.error('Authentication failed:', restErr.message);
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

