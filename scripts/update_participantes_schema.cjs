const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function updateSchema() {
    try {
        console.log('🔄 Autenticando como admin...');
        await pb.admins.authWithPassword('fabioferreoli@gmail.com', '@Cap5364125');
        console.log('✅ Autenticado!');

        const collectionName = 'agenda_cap53_participantes';
        console.log(`🔍 Buscando coleção ${collectionName}...`);
        
        const collection = await pb.collections.getOne(collectionName);
        console.log('✅ Coleção encontrada.');

        const statusField = collection.schema.find(f => f.name === 'status');
        
        if (statusField) {
            console.log(`ℹ️ Campo 'status' existe. Tipo: ${statusField.type}`);
            console.log('Opções atuais:', statusField.options);
            
            if (statusField.type === 'select') {
                const values = statusField.options.values || [];
                if (!values.includes('withdrawn')) {
                    console.log('➕ Adicionando withdrawn às opções...');
                    values.push('withdrawn');
                    statusField.options.values = values;
                    await pb.collections.update(collection.id, collection);
                    console.log('✅ Schema atualizado com sucesso!');
                } else {
                    console.log('ℹ️ withdrawn já está nas opções.');
                }
            } else if (statusField.type === 'text') {
                 console.log('ℹ️ Campo é texto, não precisa atualizar opções.');
            }
        } else {
             console.log('❌ Campo status não encontrado.');
        }

    } catch (err) {
        console.error('❌ Erro ao atualizar schema:', err.message);
        console.error('Detalhes:', err);
    }
}

updateSchema();
