
import PocketBase from 'pocketbase';

async function updateTestItem() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');
    const targetId = '043114vxyrdfdb9';

    try {
        console.log(`--- Atualizando Item TESTE (ID: ${targetId}) ---`);
        
        // Login como Admin
        const res = await fetch('https://centraldedados.duckdns.org/api/admins/auth-with-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: 'fabioferreoli@gmail.com', password: '@Cap5364125' })
        });

        if (!res.ok) throw new Error(`Login falhou: ${res.status}`);
        const authData = await res.json();
        pb.authStore.save(authData.token, authData.admin);
        console.log('Login Admin realizado.');

        // Atualizar o item
        console.log(`Alterando is_available para true...`);
        const updated = await pb.collection('agenda_cap53_itens_servico').update(targetId, {
            is_available: true
        });

        console.log('--- SUCESSO ---');
        console.log(`Item: ${updated.name}`);
        console.log(`ID: ${updated.id}`);
        console.log(`Status atual: ${updated.is_available ? 'Disponível' : 'Indisponível'}`);
        console.log(`Última atualização: ${updated.updated}`);

    } catch (err) {
        console.error('Erro ao atualizar item:', err.message);
        if (err.data) console.error('Dados do erro:', JSON.stringify(err.data, null, 2));
    }
}

updateTestItem();
