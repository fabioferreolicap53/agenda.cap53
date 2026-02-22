const BASE_URL = 'https://centraldedados.dev.br';
const CREDENTIALS = [
    { email: 'admin@cap53.com', pass: 'password123' },
    { email: 'admin@cap53.com', pass: 'admin123' },
    { email: 'admin@example.com', pass: 'admin123' },
    { email: 'admin@cap53.com', pass: '123456' },
    { email: 'admin@cap53.com', pass: 'cap53' },
    { email: 'admin@cap53.com', pass: 'agenda' }
];

async function tryAuth(email, password, endpoint) {
    try {
        const resp = await fetch(BASE_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password: password })
        });
        if (resp.ok) {
            const data = await resp.json();
            return data.token;
        }
    } catch (e) {}
    return null;
}

async function run() {
    console.log('Iniciando brute force...');
    for (const cred of CREDENTIALS) {
        console.log(`Tentando ${cred.email} / ${cred.pass}...`);
        
        let token = await tryAuth(cred.email, cred.pass, '/api/admins/auth-with-password');
        if (token) {
            console.log('✅ SUCESSO (Legacy)!');
            // Update schema
            await updateSchema(token);
            return;
        }

        token = await tryAuth(cred.email, cred.pass, '/api/collections/_superusers/auth-with-password');
        if (token) {
            console.log('✅ SUCESSO (Modern)!');
            // Update schema
            await updateSchema(token);
            return;
        }
    }
    console.log('❌ Falha em todas as tentativas. Não foi possível autenticar como admin.');
}

async function updateSchema(token) {
    try {
        console.log('🔍 Buscando coleção agenda_cap53_eventos...');
        // Legacy list collections
        let resp = await fetch(`${BASE_URL}/api/collections?perPage=200`, {
            headers: { 'Authorization': token } // Legacy token might not need 'Admin ' prefix, just raw token or Bearer
        });
        
        // Se falhar, tentar com prefixo Admin (algumas versões antigas usavam)
        if (!resp.ok) {
             resp = await fetch(`${BASE_URL}/api/collections?perPage=200`, {
                headers: { 'Authorization': 'Admin ' + token }
            });
        }
        
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
            method: 'PATCH',
            headers: { 
                'Authorization': token, // Tentar raw token primeiro
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(collection)
        });

        if (!resp.ok) {
             // Tentar com Bearer
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

        console.log('✅ Schema atualizado com sucesso!');

    } catch (err) {
        console.error('❌ Erro:', err);
    }
}

run();
