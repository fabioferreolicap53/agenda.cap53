const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function testWithAuth() {
  try {
    console.log('ðŸ” Testando com autenticaÃ§Ã£o...');
    
    // Autenticar como admin (se tivermos as credenciais)
    // Por enquanto, vamos tentar com um usuÃ¡rio comum
    
    console.log('1. Testando criaÃ§Ã£o com dados completos e autenticaÃ§Ã£o...');
    
    // Vamos tentar criar uma notificaÃ§Ã£o muito simples primeiro
    const simpleData = {
      user: 'qsi3qe4dn3peo51',
      title: 'Teste Simples',
      message: 'Mensagem de teste',
      type: 'test',
      read: false,
      acknowledged: false
    };
    
    console.log('ðŸ“‹ Dados enviados:', JSON.stringify(simpleData, null, 2));
    
    try {
      const result = await pb.collection('agenda_cap53_notifications').create(simpleData);
      console.log('âœ… SUCESSO! NotificaÃ§Ã£o criada:', result.id);
    } catch (error) {
      console.log('âŒ FALHOU');
      console.log('   Status:', error.status);
      console.log('   Mensagem:', error.message);
      console.log('   Dados:', error.data);
      
      // Tentar obter mais detalhes do erro
      if (error.response) {
        console.log('   Resposta completa:', error.response);
      }
      
      // Verificar se Ã© problema de permissÃ£o
      if (error.status === 403) {
        console.log('   âš ï¸  Parece ser um problema de permissÃ£o!');
      } else if (error.status === 400) {
        console.log('   âš ï¸  Parece ser um problema de validaÃ§Ã£o de dados!');
        
        // Tentar obter detalhes especÃ­ficos dos campos
        if (error.data && error.data.data) {
          console.log('   Campos com erro:', Object.keys(error.data.data));
          for (const field in error.data.data) {
            console.log(`   - ${field}: ${error.data.data[field].message || error.data.data[field]}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('âŒ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWithAuth();
