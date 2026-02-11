import PocketBase from 'pocketbase';

async function checkSchema() {
    const pbUrl = 'https://centraldedados.duckdns.org';
    const adminEmail = 'fabioferreoli@gmail.com';
    const adminPass = '@Cap5364125';
    const pb = new PocketBase(pbUrl);

    try {
        await pb.admins.authWithPassword(adminEmail, adminPass);
        console.log('✅ Autenticado como Admin');

        const collections = await pb.collections.getFullList();
        console.log('--- Coleções disponíveis ---');
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
        console.error('❌ Erro:', e.message);
    }
}

checkSchema();
