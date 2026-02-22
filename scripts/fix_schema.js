
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function run() {
    const pb = new PocketBase(PB_URL);

    try {
        console.log('Authenticating as admin...');
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
        console.log('Authenticated!');

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

        for (const colDef of collections) {
            console.log(`Processing collection: ${colDef.name}`);
            const collection = await pb.collections.getOne(colDef.name);
            let updated = false;
            
            // PB < 0.23 uses 'schema' as an array of field objects
            const schema = [...collection.schema];

            for (const fieldDef of colDef.fields) {
                const exists = schema.find(f => f.name === fieldDef.name);
                if (!exists) {
                    console.log(`Adding field: ${fieldDef.name}`);
                    schema.push({
                        name: fieldDef.name,
                        type: fieldDef.type,
                        required: false,
                        unique: false,
                        options: {}
                    });
                    updated = true;
                }
            }

            if (updated) {
                await pb.collections.update(collection.id, { schema });
                console.log(`Collection ${colDef.name} updated successfully.`);
            } else {
                console.log(`Collection ${colDef.name} already has all fields.`);
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
        if (e.data) console.dir(e.data, { depth: null });
    }
}

run();

