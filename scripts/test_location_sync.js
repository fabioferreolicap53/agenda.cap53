
const { PocketBase } = require('pocketbase/cjs');

async function testLocationSync() {
    const pb = new PocketBase('http://127.0.0.1:8090');
    
    console.log('--- INICIANDO TESTE DE INTEGRAÇÃO: SINCRONIZAÇÃO DE LOCAIS ---');

    try {
        // 1. Auth como Admin para manipular dados
        // Nota: Em ambiente real, usar variáveis de ambiente
        await pb.admins.authWithPassword('admin@admin.com', 'admin123456');
        console.log('✓ Autenticado como Admin');

        const collectionName = 'agenda_cap53_locais';
        const testName = `Local Teste ${Date.now()}`;

        // TESTE 1: Cadastro de novo lugar disponível
        console.log(`\nTESTE 1: Criando novo local "${testName}"...`);
        const record = await pb.collection(collectionName).create({
            name: testName,
            is_available: true,
            conflict_control: false
        });
        console.log('✓ Local criado com sucesso:', record.id);

        // TESTE 2: Verificação de presença (Simulação de lógica do CreateEvent)
        const list = await pb.collection(collectionName).getFullList({
            filter: 'is_available != false'
        });
        const found = list.find(l => l.id === record.id);
        if (found) {
            console.log('✓ TESTE 2: Local encontrado na lista de disponíveis');
        } else {
            throw new Error('Falha no TESTE 2: Local não encontrado na lista');
        }

        // TESTE 3: Alteração de status para indisponível
        console.log('\nTESTE 3: Marcando local como INDISPONÍVEL...');
        await pb.collection(collectionName).update(record.id, {
            is_available: false
        });
        const listAfterUpdate = await pb.collection(collectionName).getFullList({
            filter: 'is_available != false'
        });
        const stillFound = listAfterUpdate.find(l => l.id === record.id);
        if (!stillFound) {
            console.log('✓ TESTE 3: Local removido corretamente da lista de disponíveis');
        } else {
            throw new Error('Falha no TESTE 3: Local ainda aparece como disponível');
        }

        // TESTE 4: Exclusão lógica/física
        console.log('\nTESTE 4: Excluindo local...');
        await pb.collection(collectionName).delete(record.id);
        const listAfterDelete = await pb.collection(collectionName).getFullList();
        const deleted = listAfterDelete.find(l => l.id === record.id);
        if (!deleted) {
            console.log('✓ TESTE 4: Local excluído com sucesso');
        } else {
            throw new Error('Falha no TESTE 4: Local ainda existe no banco');
        }

        console.log('\n--- TODOS OS TESTES PASSARAM COM SUCESSO ---');

    } catch (err) {
        console.error('\n✖ ERRO DURANTE OS TESTES:', err.message);
        if (err.data) console.error('Detalhes:', err.data);
    }
}

testLocationSync();
