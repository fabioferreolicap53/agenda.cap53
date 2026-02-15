const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function testFixedQuery() {
  try {
    console.log('🔍 Testando query corrigida do useNotifications...');
    
    const userId = '7t90giut8htg8vh'; // user1@cap53.com (ALMC)
    
    console.log('1. Testando query ALMC corrigida:');
    try {
      const almcResult = await pb.collection('agenda_cap53_requests').getList(1, 50, {
        filter: 'status = "pending" && (item.category = "ALMOXARIFADO" || item.category = "COPA")',
        expand: 'item,event'
      });
      console.log(`   ✅ SUCESSO! Encontradas: ${almcResult.totalItems} solicitações ALMC pendentes`);
      
      if (almcResult.totalItems > 0) {
        almcResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. Item: "${item.expand?.item?.name || item.item}" para evento: "${item.expand?.event?.title || item.event}"`);
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Erro na query ALMC: ${error.message}`);
      console.log(`   🔍 Tentando query simplificada...`);
      
      // Tentar sem o filtro de categoria
      try {
        const simpleResult = await pb.collection('agenda_cap53_requests').getList(1, 50, {
          filter: 'status = "pending"',
          expand: 'item,event'
        });
        console.log(`   ✅ Query simplificada: ${simpleResult.totalItems} solicitações pendentes`);
        
        if (simpleResult.totalItems > 0) {
          simpleResult.items.forEach((item, index) => {
            console.log(`   ${index + 1}. Item: "${item.expand?.item?.name || item.item}" (cat: ${item.expand?.item?.category || 'unknown'}) para evento: "${item.expand?.event?.title || item.event}"`);
          });
        }
        
      } catch (error2) {
        console.log(`   ❌ Query simplificada também falhou: ${error2.message}`);
      }
    }
    
    console.log('\n2. Testando query TRA:');
    try {
      const traResult = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'transporte_suporte = true && transporte_status = "pending"'
      });
      console.log(`   ✅ Solicitações TRA: ${traResult.totalItems}`);
      
      if (traResult.totalItems > 0) {
        traResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. "${item.title}"`);
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Erro na query TRA: ${error.message}`);
    }
    
    console.log('\n3. Testando notificações do sistema:');
    try {
      const notifResult = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
        filter: `user = "${userId}"`
      });
      console.log(`   ✅ Notificações do sistema: ${notifResult.totalItems}`);
      
      if (notifResult.totalItems > 0) {
        notifResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. "${item.title}" - Lida: ${item.read}`);
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Erro nas notificações: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testFixedQuery();