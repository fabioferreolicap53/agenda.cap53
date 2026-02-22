import PocketBase from 'pocketbase';

async function checkSchema() {
    const pbUrl = 'https://centraldedados.dev.br';
    const adminEmail = 'fabioferreoli@gmail.com';
    const adminPass = '@Cap5364125';
    const pb = new PocketBase(pbUrl);

    try {
        await pb.admins.authWithPassword(adminEmail, adminPass);
        console.log('âœ… Autenticado como Admin');

        const collections = await pb.collections.getFullList();
        console.log('--- ColeÃ§Ãµes disponÃ­veis ---');
        collections.forEach(c => {
            console.log(`- ${c.name} (${c.id})`);
            if (c.name.includes('eventos')) {
                console.log('  Schema:');
                c.schema.forEach(f => {
                    console.log(`    - ${f.name} (${f.type})${f.required ? ' [REQUIRED]' : ''}`);
                });
            }
        });

    } catch (e) {
        console.error('âŒ Erro:', e.message);
    }
}

checkSchema();

