const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function checkPendingRequests() {
  try {
    console.log('🔍 Verificando solicitações pendentes...');
    
    // Verificar solicitações ALMC pendentes
    console.log('1. Solicitações ALMC pendentes:');
    try {
      const almcPending = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'almc_suporte = true && almc_status = "pending"'
      });
      console.log(`   ✅ Encontradas: ${almcPending.totalItems} solicitações`);
      if (almcPending.totalItems > 0) {
        almcPending.items.forEach((item, index) => {
          console.log(`   ${index + 1}. Evento: "${item.title}" (ID: ${item.id})`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Erro ao buscar ALMC: ${error.message}`);
    }
    
    // Verificar solicitações TRA pendentes
    console.log('\n2. Solicitações TRA pendentes:');
    try {
      const traPending = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'transporte_suporte = true && transporte_status = "pending"'
      });
      console.log(`   ✅ Encontradas: ${traPending.totalItems} solicitações`);
      if (traPending.totalItems > 0) {
        traPending.items.forEach((item, index) => {
          console.log(`   ${index + 1}. Evento: "${item.title}" (ID: ${item.id})`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Erro ao buscar TRA: ${error.message}`);
    }
    
    // Verificar notificações do sistema
    console.log('\n3. Notificações do sistema:');
    try {
      const notifications = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
        filter: 'user = "7t90giut8htg8vh"'  // user1@cap53.com
      });
      console.log(`   ✅ Encontradas: ${notifications.totalItems} notificações`);
      if (notifications.totalItems > 0) {
        notifications.items.forEach((item, index) => {
          console.log(`   ${index + 1}. "${item.title}" - ${item.message}`);
          console.log(`      Tipo: ${item.type} | Lida: ${item.read}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Erro ao buscar notificações: ${error.message}`);
    }
    
    // Verificar itens solicitados (requests)
    console.log('\n4. Itens solicitados (requests):');
    try {
      const requests = await pb.collection('agenda_cap53_requests').getList(1, 50, {
        filter: 'event.almc_suporte = true && event.almc_status = "pending"',
        expand: 'event,item'
      });
      console.log(`   ✅ Encontradas: ${requests.totalItems} requests`);
      if (requests.totalItems > 0) {
        requests.items.forEach((item, index) => {
          console.log(`   ${index + 1}. Item: "${item.expand?.item?.name || item.item}" para "${item.expand?.event?.title || item.event}"`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Erro ao buscar requests: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

checkPendingRequests();