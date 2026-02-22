const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function testPermission() {
  try {
    console.log('ðŸ” Testando permissÃµes no PocketBase remoto...');
    
    // Testar se conseguimos listar notificaÃ§Ãµes (sem autenticaÃ§Ã£o)
    console.log('1. Testando listagem sem autenticaÃ§Ã£o...');
    try {
      const listTest = await pb.collection('agenda_cap53_notifications').getList(1, 1);
      console.log('âœ… Listagem sem autenticaÃ§Ã£o: SUCESSO');
    } catch (error) {
      console.log('âŒ Listagem sem autenticaÃ§Ã£o: FALHOU');
      console.log('   Erro:', error.message);
      console.log('   CÃ³digo:', error.status);
    }
    
    // Testar criaÃ§Ã£o sem autenticaÃ§Ã£o
    console.log('\n2. Testando criaÃ§Ã£o sem autenticaÃ§Ã£o...');
    try {
      const createTest = await pb.collection('agenda_cap53_notifications').create({
        user: 'qsi3qe4dn3peo51',
        title: 'Teste de PermissÃ£o',
        message: 'Testando se podemos criar notificaÃ§Ãµes',
        type: 'test',
        read: false,
        acknowledged: false
      });
      console.log('âœ… CriaÃ§Ã£o sem autenticaÃ§Ã£o: SUCESSO');
      console.log('   ID:', createTest.id);
    } catch (error) {
      console.log('âŒ CriaÃ§Ã£o sem autenticaÃ§Ã£o: FALHOU');
      console.log('   Erro:', error.message);
      console.log('   CÃ³digo:', error.status);
      console.log('   Detalhes:', error.data);
    }
    
    // Verificar schema da coleÃ§Ã£o
    console.log('\n3. Verificando schema da coleÃ§Ã£o...');
    try {
      const schema = await pb.collections.getOne('agenda_cap53_notifications');
      console.log('âœ… Schema obtido com sucesso');
      console.log('   Campos obrigatÃ³rios:', schema.schema.filter(field => field.required).map(f => f.name));
      console.log('   PermissÃµes de criaÃ§Ã£o:', schema.createRule);
      console.log('   PermissÃµes de listagem:', schema.listRule);
    } catch (error) {
      console.log('âŒ Falha ao obter schema');
      console.log('   Erro:', error.message);
    }
    
  } catch (error) {
    console.error('âŒ Erro geral:', error.message);
  }
}

testPermission();
