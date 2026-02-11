
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function checkSchema() {
    const pb = new PocketBase(PB_URL);

    try {
        console.log('Authenticating...');
        try {
            await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('Authenticated as Admin (legacy).');
        } catch (e) {
            await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('Authenticated as Superuser (modern).');
        }

        const collection = await pb.collections.getOne('agenda_cap53_itens_servico');
        console.log('Schema for agenda_cap53_itens_servico:');
        console.log(JSON.stringify(collection.schema, null, 2));
        console.log('API Rules:');
        console.log({
            listRule: collection.listRule,
            viewRule: collection.viewRule,
            createRule: collection.createRule,
            updateRule: collection.updateRule,
            deleteRule: collection.deleteRule,
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkSchema();
