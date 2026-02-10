import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function verifyEventFields() {
    const pb = new PocketBase(PB_URL);

    try {
        console.log('Authenticating...');
        try {
            await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('Authenticated as Admin.');
        } catch (e) {
            console.log('Admin auth failed, trying collection auth...');
            // In newer PB versions, admins are in _superusers or handled differently
            try {
                await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
                console.log('Authenticated as Superuser.');
            } catch (e2) {
                 console.error('All auth methods failed');
                 return;
            }
        }

        console.log('\nChecking collection schema for agenda_cap53_eventos...');
        const collection = await pb.collections.getOne('agenda_cap53_eventos');
        const fieldNames = collection.schema.map(f => f.name);
        console.log('Schema fields:', fieldNames);
        
        if (fieldNames.includes('creator_role')) {
            console.log('✅ Field "creator_role" exists in schema.');
        } else {
            console.log('❌ Field "creator_role" is MISSING from schema.');
            
            // Try to add it
            console.log('Attempting to add "creator_role" field to schema...');
            collection.schema.push({
                name: 'creator_role',
                type: 'text',
                required: false,
                presentable: false,
                unique: false,
                options: {}
            });
            await pb.collections.update(collection.id, collection);
            console.log('✅ Field "creator_role" added successfully.');
        }

        // Check if any record has it populated
        const records = await pb.collection('agenda_cap53_eventos').getFullList({ 
            filter: 'creator_role != ""',
            perPage: 5 
        });
        console.log(`\nFound ${records.length} records with creator_role populated.`);
        if (records.length > 0) {
            console.log('Sample creator_role values:', records.map(r => r.creator_role));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

verifyEventFields();
