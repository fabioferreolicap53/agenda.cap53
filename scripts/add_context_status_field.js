import PocketBase from 'pocketbase';

// Configuração - Ajuste se necessário
const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125'; // Senha encontrada nos scripts anteriores

const pb = new PocketBase(PB_URL);

async function addContextStatusField() {
    console.log(`Conectando a ${PB_URL}...`);

    try {
        // 1. Autenticação Admin
        // Tenta autenticar via API direta porque a SDK pode usar _superusers que falha em algumas versões
        const endpoints = ['/api/superusers/auth-with-password', '/api/admins/auth-with-password'];
        let authenticated = false;

        for (const endpoint of endpoints) {
            try {
                const res = await fetch(`${PB_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
                });
                if (res.ok) {
                    const data = await res.json();
                    pb.authStore.save(data.token, data.admin || data.superuser);
                    authenticated = true;
                    console.log(`Autenticado via ${endpoint}`);
                    break;
                }
            } catch (e) { }
        }

        if (!authenticated) {
            throw new Error('Falha na autenticação Admin');
        }

        console.log('Autenticação Admin realizada com sucesso!');

        // 2. Buscar a coleção de usuários
        const collection = await pb.collections.getOne('agenda_cap53_usuarios');
        console.log(`Coleção encontrada: ${collection.name} (ID: ${collection.id})`);

        // 3. Verificar se o campo já existe
        const schema = collection.schema;
        const fieldExists = schema.find(f => f.name === 'context_status');

        if (fieldExists) {
            console.log('✅ O campo "context_status" já existe. Nenhuma alteração necessária.');
            return;
        }

        // 4. Adicionar o novo campo
        console.log('Adicionando campo "context_status"...');
        schema.push({
            name: 'context_status',
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

        // 5. Atualizar a coleção
        await pb.collections.update(collection.id, { schema });
        console.log('✅ Sucesso! Campo "context_status" adicionado à coleção.');

    } catch (error) {
        console.error('❌ Erro:', error.originalError || error.message);
    }
}

addContextStatusField();
