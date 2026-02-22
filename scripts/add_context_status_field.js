import PocketBase from 'pocketbase';

// ConfiguraÃ§Ã£o - Ajuste se necessÃ¡rio
const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125'; // Senha encontrada nos scripts anteriores

const pb = new PocketBase(PB_URL);

async function addContextStatusField() {
    console.log(`Conectando a ${PB_URL}...`);

    try {
        // 1. AutenticaÃ§Ã£o Admin
        // Tenta autenticar via API direta porque a SDK pode usar _superusers que falha em algumas versÃµes
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
            throw new Error('Falha na autenticaÃ§Ã£o Admin');
        }

        console.log('AutenticaÃ§Ã£o Admin realizada com sucesso!');

        // 2. Buscar a coleÃ§Ã£o de usuÃ¡rios
        const collection = await pb.collections.getOne('agenda_cap53_usuarios');
        console.log(`ColeÃ§Ã£o encontrada: ${collection.name} (ID: ${collection.id})`);

        // 3. Verificar se o campo jÃ¡ existe
        const schema = collection.schema;
        const fieldExists = schema.find(f => f.name === 'context_status');

        if (fieldExists) {
            console.log('âœ… O campo "context_status" jÃ¡ existe. Nenhuma alteraÃ§Ã£o necessÃ¡ria.');
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

        // 5. Atualizar a coleÃ§Ã£o
        await pb.collections.update(collection.id, { schema });
        console.log('âœ… Sucesso! Campo "context_status" adicionado Ã  coleÃ§Ã£o.');

    } catch (error) {
        console.error('âŒ Erro:', error.originalError || error.message);
    }
}

addContextStatusField();

