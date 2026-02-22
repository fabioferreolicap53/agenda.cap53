
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function migrate() {
    console.log('--- Migração de Histórico ---');
    
    // Autenticação Manual (Rota Legada)
    try {
        const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
        });
        
        if (!authRes.ok) throw new Error('Falha na autenticação Admin');
        const authData = await authRes.json();
        pb.authStore.save(authData.token, null); // Salva token manualmente
        console.log('✅ Autenticado como Admin');
    } catch (e) {
        console.error('Erro fatal de autenticação:', e);
        return;
    }

    const collectionsToUpdate = [
        { name: 'agenda_cap53_almac_requests', field: 'history', label: 'Histórico de Interações' },
        { name: 'agenda_cap53_eventos', field: 'transport_history', label: 'Histórico de Transporte' }
    ];

    for (const { name, field, label } of collectionsToUpdate) {
        try {
            console.log(`Verificando coleção: ${name}...`);
            const collection = await pb.collections.getOne(name);
            
            const hasField = collection.schema.some(f => f.name === field);
            
            if (!hasField) {
                console.log(`Field '${field}' not found. Adding...`);
                const newSchema = [
                    ...collection.schema,
                    {
                        name: field,
                        type: 'json',
                        system: false,
                        required: false,
                        options: {
                            maxSize: 2000000
                        }
                    }
                ];
                
                await pb.collections.update(collection.id, { schema: newSchema });
                console.log(`✅ Field '${field}' added to '${name}'.`);
            } else {
                console.log(`ℹ️ Field '${field}' already exists in '${name}'.`);
            }
        } catch (e) {
            console.error(`Erro ao processar ${name}:`, e.message);
        }
    }
}

migrate();
