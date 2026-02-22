const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function checkPendingRequests() {
  try {
    console.log('ðŸ” Verificando solicitaÃ§Ãµes pendentes...');
    
    // Verificar solicitaÃ§Ãµes ALMC pendentes
    console.log('1. SolicitaÃ§Ãµes ALMC pendentes:');
    try {
      const almcPending = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'almc_suporte = true && almc_status = "pending"'
      });
      console.log(`   âœ… Encontradas: ${almcPending.totalItems} solicitaÃ§Ãµes`);
      if (almcPending.totalItems > 0) {
        almcPending.items.forEach((item, index) => {
          console.log(`   ${index + 1}. Evento: "${item.title}" (ID: ${item.id})`);
        });
      }
    } catch (error) {
      console.log(`   âŒ Erro ao buscar ALMC: ${error.message}`);
    }
    
    // Verificar solicitaÃ§Ãµes TRA pendentes
    console.log('\n2. SolicitaÃ§Ãµes TRA pendentes:');
    try {
      const traPending = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'transporte_suporte = true && transporte_status = "pending"'
      });
      console.log(`   âœ… Encontradas: ${traPending.totalItems} solicitaÃ§Ãµes`);
      if (traPending.totalItems > 0) {
        traPending.items.forEach((item, index) => {
          console.log(`   ${index + 1}. Evento: "${item.title}" (ID: ${item.id})`);
        });
      }
    } catch (error) {
      console.log(`   âŒ Erro ao buscar TRA: ${error.message}`);
    }
    
    // Verificar notificaÃ§Ãµes do sistema
    console.log('\n3. NotificaÃ§Ãµes do sistema:');
    try {
      const notifications = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
        filter: 'user = "7t90giut8htg8vh"'  // user1@cap53.com
      });
      console.log(`   âœ… Encontradas: ${notifications.totalItems} notificaÃ§Ãµes`);
      if (notifications.totalItems > 0) {
        notifications.items.forEach((item, index) => {
          console.log(`   ${index + 1}. "${item.title}" - ${item.message}`);
          console.log(`      Tipo: ${item.type} | Lida: ${item.read}`);
        });
      }
    } catch (error) {
      console.log(`   âŒ Erro ao buscar notificaÃ§Ãµes: ${error.message}`);
    }
    
    // Verificar itens solicitados (requests)
    console.log('\n4. Itens solicitados (requests):');
    try {
      const requests = await pb.collection('agenda_cap53_requests').getList(1, 50, {
        filter: 'event.almc_suporte = true && event.almc_status = "pending"',
        expand: 'event,item'
      });
      console.log(`   âœ… Encontradas: ${requests.totalItems} requests`);
      if (requests.totalItems > 0) {
        requests.items.forEach((item, index) => {
          console.log(`   ${index + 1}. Item: "${item.expand?.item?.name || item.item}" para "${item.expand?.event?.title || item.event}"`);
        });
      }
    } catch (error) {
      console.log(`   âŒ Erro ao buscar requests: ${error.message}`);
    }
    
  } catch (error) {
    console.error('âŒ Erro geral:', error.message);
  }
}

checkPendingRequests();
