const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function testPermission() {
  try {
    console.log('🔍 Testando permissões no PocketBase remoto...');
    
    // Testar se conseguimos listar notificações (sem autenticação)
    console.log('1. Testando listagem sem autenticação...');
    try {
      const listTest = await pb.collection('agenda_cap53_notifications').getList(1, 1);
      console.log('✅ Listagem sem autenticação: SUCESSO');
    } catch (error) {
      console.log('❌ Listagem sem autenticação: FALHOU');
      console.log('   Erro:', error.message);
      console.log('   Código:', error.status);
    }
    
    // Testar criação sem autenticação
    console.log('\n2. Testando criação sem autenticação...');
    try {
      const createTest = await pb.collection('agenda_cap53_notifications').create({
        user: 'qsi3qe4dn3peo51',
        title: 'Teste de Permissão',
        message: 'Testando se podemos criar notificações',
        type: 'test',
        read: false,
        acknowledged: false
      });
      console.log('✅ Criação sem autenticação: SUCESSO');
      console.log('   ID:', createTest.id);
    } catch (error) {
      console.log('❌ Criação sem autenticação: FALHOU');
      console.log('   Erro:', error.message);
      console.log('   Código:', error.status);
      console.log('   Detalhes:', error.data);
    }
    
    // Verificar schema da coleção
    console.log('\n3. Verificando schema da coleção...');
    try {
      const schema = await pb.collections.getOne('agenda_cap53_notifications');
      console.log('✅ Schema obtido com sucesso');
      console.log('   Campos obrigatórios:', schema.schema.filter(field => field.required).map(f => f.name));
      console.log('   Permissões de criação:', schema.createRule);
      console.log('   Permissões de listagem:', schema.listRule);
    } catch (error) {
      console.log('❌ Falha ao obter schema');
      console.log('   Erro:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testPermission();