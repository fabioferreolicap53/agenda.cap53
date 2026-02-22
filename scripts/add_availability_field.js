
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

async function authenticate() {
    console.log(`Connecting to ${PB_URL}...`);
    try {
        // Tentar autenticaÃ§Ã£o de admin (PocketBase < 0.23)
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
        console.log('Authenticated successfully as Admin (legacy).');
    } catch (e) {
        try {
            // Tentar autenticaÃ§Ã£o unificada (PocketBase >= 0.23)
            await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
            console.log('Authenticated successfully as Superuser.');
        } catch (e2) {
            console.error('Authentication failed:', e.message, '| Superuser error:', e2.message);
            process.exit(1);
        }
    }
}

async function updateSchema() {
    await authenticate();

    const collections = [
        {
            name: 'agenda_cap53_itens_servico',
            fields: [
                { name: 'is_available', type: 'bool' },
                { name: 'unit', type: 'text' }
            ]
        },
        {
            name: 'agenda_cap53_almac_requests',
            fields: [
                { name: 'item_snapshot_available', type: 'bool' }
            ]
        }
    ];

    for (const colInfo of collections) {
        try {
            console.log(`Checking collection: ${colInfo.name}`);
            const collection = await pb.collections.getOne(colInfo.name);
            
            let updated = false;
            const newSchema = [...collection.schema];

            for (const field of colInfo.fields) {
                if (!newSchema.find(f => f.name === field.name)) {
                    console.log(`Adding field "${field.name}" to "${colInfo.name}"`);
                    newSchema.push(field);
                    updated = true;
                }
            }

            if (updated) {
                await pb.collections.update(collection.id, {
                    schema: newSchema
                });
                console.log(`Collection "${colInfo.name}" updated successfully.`);
            } else {
                console.log(`Collection "${colInfo.name}" already has all fields.`);
            }
        } catch (e) {
            console.error(`Error processing collection "${colInfo.name}":`, e.message);
        }
    }
}

updateSchema();

