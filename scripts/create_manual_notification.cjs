const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function createManualNotification() {
  try {
    console.log('🔍 Criando notificação manual com dados mínimos...');
    
    // Vamos tentar criar uma notificação com apenas os campos absolutamente necessários
    // e ver qual erro específico o PocketBase nos dá
    
    const testData = {
      user: 'qsi3qe4dn3peo51',
      title: 'Teste Manual',
      message: 'Teste de notificação manual',
      type: 'almc_item_request'
    };
    
    console.log('📋 Tentando criar com dados:', testData);
    
    try {
      const result = await pb.collection('agenda_cap53_notifications').create(testData);
      console.log('✅ SUCESSO! Notificação criada manualmente:', result.id);
      
      // Verificar se realmente foi salva
      const verify = await pb.collection('agenda_cap53_notifications').getOne(result.id);
      console.log('✅ Verificação: Notificação encontrada no banco!');
      
    } catch (error) {
      console.log('❌ FALHA ao criar notificação manual');
      console.log('   Erro completo:', error);
      
      // Vamos tentar obter mais detalhes do erro
      if (error.originalError) {
        console.log('   Erro original:', error.originalError);
      }
      
      // Tentar diferentes abordagens
      console.log('\n🔍 Tentando abordagem alternativa...');
      
      // Talvez o problema seja que precisamos autenticar primeiro
      console.log('🔄 Tentando autenticar como usuário...');
      
      // Vamos verificar se conseguimos autenticar com um usuário existente
      // Mas primeiro, vamos tentar criar com campos padrão do PocketBase
      
      const minimalData = {
        user: 'qsi3qe4dn3peo51',
        title: 'Teste',
        message: 'Teste'
      };
      
      console.log('📋 Tentando com dados mínimos:', minimalData);
      
      try {
        const result2 = await pb.collection('agenda_cap53_notifications').create(minimalData);
        console.log('✅ SUCESSO com dados mínimos:', result2.id);
      } catch (error2) {
        console.log('❌ Falha mesmo com dados mínimos');
        console.log('   Erro:', error2.message);
        
        // Última tentativa: verificar se o problema é o tipo de notificação
        console.log('\n🔍 Verificando se o problema é o tipo...');
        
        const typeTest = {
          user: 'qsi3qe4dn3peo51',
          title: 'Teste Tipo',
          message: 'Teste',
          type: 'test' // Tipo genérico
        };
        
        try {
          const result3 = await pb.collection('agenda_cap53_notifications').create(typeTest);
          console.log('✅ SUCESSO com tipo genérico:', result3.id);
        } catch (error3) {
          console.log('❌ Falha até com tipo genérico');
          console.log('   Erro final:', error3.message);
          console.log('   💡 CONCLUSÃO: O PocketBase remoto está bloqueando criações!');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

createManualNotification();