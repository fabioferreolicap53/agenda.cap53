const BASE_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'admin@cap53.com';
const ADMIN_PASS = 'password123';

async function run() {
    try {
        console.log('Tentando autenticar...');
        let token;
        
        // Tentar endpoint antigo (v0.22-)
        let resp = await fetch(`${BASE_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
        });

        if (resp.ok) {
            const data = await resp.json();
            token = data.token;
            console.log('✅ Autenticado via /api/admins/auth-with-password (Legacy API)');
        } else {
            console.log('⚠️ Falha no endpoint antigo:', resp.status);
            // Tentar endpoint novo (v0.23+)
             resp = await fetch(`${BASE_URL}/api/collections/_superusers/auth-with-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
            });
            
            if (resp.ok) {
                const data = await resp.json();
                token = data.token;
                 console.log('✅ Autenticado via /api/collections/_superusers/auth-with-password (Modern API)');
            } else {
                console.error('❌ Falha na autenticação em ambos endpoints.');
                const err = await resp.text();
                console.error(err);
                return;
            }
        }

        // Listar coleções
        console.log('🔍 Buscando coleção agenda_cap53_eventos...');
        resp = await fetch(`${BASE_URL}/api/collections?perPage=200`, {
            headers: { 'Authorization': token }
        });
        
        if (!resp.ok) throw new Error('Falha ao listar coleções');
        const collectionsData = await resp.json();
        const items = collectionsData.items || collectionsData; 
        
        const collection = items.find(c => c.name === 'agenda_cap53_eventos');
        if (!collection) throw new Error('Coleção agenda_cap53_eventos não encontrada');

        console.log('✅ Coleção encontrada:', collection.id);

        // Check field
        const hasField = collection.schema.some(f => f.name === 'transporte_passageiro');
        if (hasField) {
            console.log('ℹ️ Campo transporte_passageiro já existe.');
            return;
        }

        console.log('➕ Adicionando campo transporte_passageiro...');
        collection.schema.push({
            name: 'transporte_passageiro',
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

        // Update
        resp = await fetch(`${BASE_URL}/api/collections/${collection.id}`, {
            method: 'PATCH', // PB usa PATCH para update parcial, mas schema é full replace no campo schema geralmente. PUT ou PATCH funcionam.
            headers: { 
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(collection)
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error('Falha ao atualizar schema: ' + err);
        }

        console.log('✅ Schema atualizado com sucesso! O campo agora deve ser salvo corretamente.');

    } catch (err) {
        console.error('❌ Erro:', err);
    }
}

run();
