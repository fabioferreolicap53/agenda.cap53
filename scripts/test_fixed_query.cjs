const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function testFixedQuery() {
  try {
    console.log('ðŸ” Testando query corrigida do useNotifications...');
    
    const userId = '7t90giut8htg8vh'; // user1@cap53.com (ALMC)
    
    console.log('1. Testando query ALMC corrigida:');
    try {
      const almcResult = await pb.collection('agenda_cap53_requests').getList(1, 50, {
        filter: 'status = "pending" && (item.category = "ALMOXARIFADO" || item.category = "COPA")',
        expand: 'item,event'
      });
      console.log(`   âœ… SUCESSO! Encontradas: ${almcResult.totalItems} solicitaÃ§Ãµes ALMC pendentes`);
      
      if (almcResult.totalItems > 0) {
        almcResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. Item: "${item.expand?.item?.name || item.item}" para evento: "${item.expand?.event?.title || item.event}"`);
        });
      }
      
    } catch (error) {
      console.log(`   âŒ Erro na query ALMC: ${error.message}`);
      console.log(`   ðŸ” Tentando query simplificada...`);
      
      // Tentar sem o filtro de categoria
      try {
        const simpleResult = await pb.collection('agenda_cap53_requests').getList(1, 50, {
          filter: 'status = "pending"',
          expand: 'item,event'
        });
        console.log(`   âœ… Query simplificada: ${simpleResult.totalItems} solicitaÃ§Ãµes pendentes`);
        
        if (simpleResult.totalItems > 0) {
          simpleResult.items.forEach((item, index) => {
            console.log(`   ${index + 1}. Item: "${item.expand?.item?.name || item.item}" (cat: ${item.expand?.item?.category || 'unknown'}) para evento: "${item.expand?.event?.title || item.event}"`);
          });
        }
        
      } catch (error2) {
        console.log(`   âŒ Query simplificada tambÃ©m falhou: ${error2.message}`);
      }
    }
    
    console.log('\n2. Testando query TRA:');
    try {
      const traResult = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'transporte_suporte = true && transporte_status = "pending"'
      });
      console.log(`   âœ… SolicitaÃ§Ãµes TRA: ${traResult.totalItems}`);
      
      if (traResult.totalItems > 0) {
        traResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. "${item.title}"`);
        });
      }
      
    } catch (error) {
      console.log(`   âŒ Erro na query TRA: ${error.message}`);
    }
    
    console.log('\n3. Testando notificaÃ§Ãµes do sistema:');
    try {
      const notifResult = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
        filter: `user = "${userId}"`
      });
      console.log(`   âœ… NotificaÃ§Ãµes do sistema: ${notifResult.totalItems}`);
      
      if (notifResult.totalItems > 0) {
        notifResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. "${item.title}" - Lida: ${item.read}`);
        });
      }
      
    } catch (error) {
      console.log(`   âŒ Erro nas notificaÃ§Ãµes: ${error.message}`);
    }
    
  } catch (error) {
    console.error('âŒ Erro geral:', error.message);
  }
}

testFixedQuery();
