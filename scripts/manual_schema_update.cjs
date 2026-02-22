const BASE_URL = 'https://centraldedados.dev.br';

// ⚠️ ATENÇÃO: PREENCHA A SENHA CORRETA DO ADMIN ABAIXO ANTES DE RODAR
const ADMIN_EMAIL = 'admin@cap53.com';
const ADMIN_PASS = 'password123'; // Substitua pela senha real se for diferente

async function run() {
    try {
        console.log('🔐 Tentando autenticar...');
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
            console.log('✅ Autenticado (API Legada)');
        } else {
            // Tentar endpoint novo (v0.23+)
             resp = await fetch(`${BASE_URL}/api/collections/_superusers/auth-with-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
            });
            
            if (resp.ok) {
                const data = await resp.json();
                token = data.token;
                 console.log('✅ Autenticado (API Moderna)');
            } else {
                console.error('❌ Falha na autenticação. Verifique a senha no script.');
                return;
            }
        }

        // Listar coleções
        console.log('🔍 Buscando coleção agenda_cap53_eventos...');
        resp = await fetch(`${BASE_URL}/api/collections?perPage=200`, {
            headers: { 'Authorization': token }
        });
        
        // Fallback para headers antigos se necessário
        if (!resp.ok) {
             resp = await fetch(`${BASE_URL}/api/collections?perPage=200`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
        }

        if (!resp.ok) throw new Error('Falha ao listar coleções');
        const collectionsData = await resp.json();
        const items = collectionsData.items || collectionsData; 
        
        const collection = items.find(c => c.name === 'agenda_cap53_eventos');
        if (!collection) throw new Error('Coleção agenda_cap53_eventos não encontrada');

        console.log('✅ Coleção encontrada:', collection.id);

        const hasField = collection.schema.some(f => f.name === 'transporte_passageiro');
        if (hasField) {
            console.log('ℹ️ Campo transporte_passageiro já existe no schema.');
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
            method: 'PATCH',
            headers: { 
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(collection)
        });

        if (!resp.ok) {
             resp = await fetch(`${BASE_URL}/api/collections/${collection.id}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(collection)
            });
        }

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error('Falha ao atualizar schema: ' + err);
        }

        console.log('✅ SUCESSO! Schema atualizado. O campo transporte_passageiro agora será salvo.');

    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

run();
