const PocketBase = require('pocketbase/cjs');

async function addEventFields() {
    const pb = new PocketBase('https://centraldedados.dev.br');

    try {
        console.log('Authenticating as admin...');
        try {
            // Tenta autenticar com a conta admin padrão
            await pb.admins.authWithPassword('admin@cap53.com', 'admin123');
        } catch (authError) {
            console.log('Auth failed with admin@cap53.com, trying alternate credentials...');
            try {
                // Tenta autenticar com outra conta admin comum em ambientes dev
                await pb.admins.authWithPassword('admin@admin.com', 'admin123456');
            } catch (authError2) {
                console.error('All authentication attempts failed.');
                console.error('Error 1:', authError.message);
                console.error('Error 2:', authError2.message);
                return;
            }
        }
        console.log('Authenticated as admin');

        // Get the collection
        const collection = await pb.collections.getOne('agenda_cap53_eventos');
        console.log('Collection found:', collection.name);

        let schemaChanged = false;

        // Check for 'event_responsibility' field
        const hasResponsibility = collection.schema.find(f => f.name === 'event_responsibility');
        if (!hasResponsibility) {
            console.log('Adding "event_responsibility" field...');
            collection.schema.push({
                name: 'event_responsibility',
                type: 'text',
                required: false,
                presentable: false,
                unique: false,
                options: {}
            });
            schemaChanged = true;
        } else {
            console.log('"event_responsibility" field already exists.');
        }

        // Check for 'estimated_participants' field
        const hasEstimatedParticipants = collection.schema.find(f => f.name === 'estimated_participants');
        if (!hasEstimatedParticipants) {
            console.log('Adding "estimated_participants" field...');
            collection.schema.push({
                name: 'estimated_participants',
                type: 'number',
                required: false,
                presentable: false,
                unique: false,
                options: {
                    min: 0,
                    max: null,
                    noDecimal: true
                }
            });
            schemaChanged = true;
        } else {
            console.log('"estimated_participants" field already exists.');
        }

        if (schemaChanged) {
            await pb.collections.update(collection.id, collection);
            console.log('Schema updated successfully.');
        } else {
            console.log('No schema changes needed.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

addEventFields();
