
import PocketBase from 'pocketbase';

async function checkUsersSchema() {
    const pb = new PocketBase('https://centraldedados.dev.br');

    try {
        console.log('Authenticating as admin...');
        await pb.admins.authWithPassword('fabioferreoli@gmail.com', '@Cap5364125');

        console.log('Fetching "users" collection...');
        const collection = await pb.collections.getOne('users');
        
        console.log('--- Rules ---');
        console.log('Update Rule:', collection.updateRule);
        
        console.log('--- Schema ---');
        collection.schema.forEach(field => {
            console.log(`- ${field.name} (${field.type})`);
            if (field.name === 'role') {
                console.log('  Options:', field.options);
            }
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkUsersSchema();

