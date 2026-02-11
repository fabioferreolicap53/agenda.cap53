
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function verifyFields() {
    const pb = new PocketBase(PB_URL);

    try {
        console.log('Authenticating...');
        try {
            await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('Authenticated as Admin.');
        } catch (e) {
            await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('Authenticated as Superuser.');
        }

        console.log('Fetching records from agenda_cap53_itens_servico...');
        const records = await pb.collection('agenda_cap53_itens_servico').getFullList({ perPage: 5 });
        console.log('Records found:', records.length);
        if (records.length > 0) {
            console.log('Fields in first record:', Object.keys(records[0]));
            console.log('Sample record values:', JSON.stringify({
                name: records[0].name,
                category: records[0].category,
                is_available: records[0].is_available,
                unit: records[0].unit
            }, null, 2));
        } else {
            console.log('No records found.');
        }

        console.log('\nChecking collection schema directly...');
        const collection = await pb.collections.getOne('agenda_cap53_itens_servico');
        console.log('Schema fields:', collection.schema.map(f => `${f.name} (${f.type})`));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

verifyFields();
