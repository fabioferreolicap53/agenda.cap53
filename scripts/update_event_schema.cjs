const PocketBase = require('pocketbase/cjs');

// URL hardcoded baseada no script de check existente
const pb = new PocketBase('https://centraldedados.dev.br');

async function updateSchema() {
    try {
        console.log('🔄 Autenticando como admin...');
        // Credenciais obtidas de Acesso.txt
        await pb.admins.authWithPassword('admin@cap53.com', 'password123');
        console.log('✅ Autenticado!');

        const collectionName = 'agenda_cap53_eventos';
        console.log(`🔍 Buscando coleção ${collectionName}...`);
        
        const collection = await pb.collections.getOne(collectionName);
        console.log('✅ Coleção encontrada.');

        const fieldName = 'transporte_passageiro';
        const hasField = collection.schema.some(f => f.name === fieldName);
        
        if (hasField) {
            console.log(`ℹ️ Campo '${fieldName}' já existe no schema.`);
            
            // Opcional: Verificar se o tipo está correto, mas vamos assumir que se existe, ok.
            // Poderíamos forçar update se necessário.
            return;
        }

        console.log(`➕ Adicionando campo '${fieldName}' ao schema...`);
        
        // Adicionando como texto para máxima flexibilidade
        collection.schema.push({
            name: fieldName,
            type: 'text',
            required: false,
            presentable: false,
            unique: false,
            options: {
                min: null,
                max: null,
                pattern: ""
            }
        });

        await pb.collections.update(collection.id, collection);
        console.log('✅ Schema atualizado com sucesso! O campo agora deve ser salvo corretamente.');

    } catch (err) {
        console.error('❌ Erro ao atualizar schema:', err.message);
        console.error('Detalhes:', err);
    }
}

updateSchema();
