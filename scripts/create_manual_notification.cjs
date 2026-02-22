const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function createManualNotification() {
  try {
    console.log('ðŸ” Criando notificaÃ§Ã£o manual com dados mÃ­nimos...');
    
    // Vamos tentar criar uma notificaÃ§Ã£o com apenas os campos absolutamente necessÃ¡rios
    // e ver qual erro especÃ­fico o PocketBase nos dÃ¡
    
    const testData = {
      user: 'qsi3qe4dn3peo51',
      title: 'Teste Manual',
      message: 'Teste de notificaÃ§Ã£o manual',
      type: 'almc_item_request'
    };
    
    console.log('ðŸ“‹ Tentando criar com dados:', testData);
    
    try {
      const result = await pb.collection('agenda_cap53_notifications').create(testData);
      console.log('âœ… SUCESSO! NotificaÃ§Ã£o criada manualmente:', result.id);
      
      // Verificar se realmente foi salva
      const verify = await pb.collection('agenda_cap53_notifications').getOne(result.id);
      console.log('âœ… VerificaÃ§Ã£o: NotificaÃ§Ã£o encontrada no banco!');
      
    } catch (error) {
      console.log('âŒ FALHA ao criar notificaÃ§Ã£o manual');
      console.log('   Erro completo:', error);
      
      // Vamos tentar obter mais detalhes do erro
      if (error.originalError) {
        console.log('   Erro original:', error.originalError);
      }
      
      // Tentar diferentes abordagens
      console.log('\nðŸ” Tentando abordagem alternativa...');
      
      // Talvez o problema seja que precisamos autenticar primeiro
      console.log('ðŸ”„ Tentando autenticar como usuÃ¡rio...');
      
      // Vamos verificar se conseguimos autenticar com um usuÃ¡rio existente
      // Mas primeiro, vamos tentar criar com campos padrÃ£o do PocketBase
      
      const minimalData = {
        user: 'qsi3qe4dn3peo51',
        title: 'Teste',
        message: 'Teste'
      };
      
      console.log('ðŸ“‹ Tentando com dados mÃ­nimos:', minimalData);
      
      try {
        const result2 = await pb.collection('agenda_cap53_notifications').create(minimalData);
        console.log('âœ… SUCESSO com dados mÃ­nimos:', result2.id);
      } catch (error2) {
        console.log('âŒ Falha mesmo com dados mÃ­nimos');
        console.log('   Erro:', error2.message);
        
        // Ãšltima tentativa: verificar se o problema Ã© o tipo de notificaÃ§Ã£o
        console.log('\nðŸ” Verificando se o problema Ã© o tipo...');
        
        const typeTest = {
          user: 'qsi3qe4dn3peo51',
          title: 'Teste Tipo',
          message: 'Teste',
          type: 'test' // Tipo genÃ©rico
        };
        
        try {
          const result3 = await pb.collection('agenda_cap53_notifications').create(typeTest);
          console.log('âœ… SUCESSO com tipo genÃ©rico:', result3.id);
        } catch (error3) {
          console.log('âŒ Falha atÃ© com tipo genÃ©rico');
          console.log('   Erro final:', error3.message);
          console.log('   ðŸ’¡ CONCLUSÃƒO: O PocketBase remoto estÃ¡ bloqueando criaÃ§Ãµes!');
        }
      }
    }
    
  } catch (error) {
    console.error('âŒ Erro geral:', error.message);
  }
}

createManualNotification();
