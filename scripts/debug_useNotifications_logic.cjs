const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function debugUseNotificationsLogic() {
  try {
    console.log('ðŸ” Debugando a lÃ³gica exata do useNotifications...');
    
    const userId = '7t90giut8htg8vh'; // user1@cap53.com
    
    console.log('1. Buscando notificaÃ§Ãµes do sistema (igual ao useNotifications):');
    try {
      const notifResult = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
        filter: `user = "${userId}"`,
        sort: '-created',
        expand: 'event,related_event,related_request,related_request.item,related_request.created_by,event.user'
      });
      console.log(`   âœ… NotificaÃ§Ãµes encontradas: ${notifResult.totalItems}`);
      
      if (notifResult.totalItems > 0) {
        notifResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. "${item.title}" - Lida: ${item.read}`);
        });
      }
      
      // Calcular unread count (igual ao useNotifications)
      const systemUnread = notifResult.items.filter(n => !n.read).length;
      console.log(`   ðŸ“Š Unread count do sistema: ${systemUnread}`);
      
    } catch (error) {
      console.log(`   âŒ Erro ao buscar notificaÃ§Ãµes: ${error.message}`);
    }
    
    console.log('\n2. Buscando solicitaÃ§Ãµes ALMC (igual ao useNotifications):');
    try {
      const almcResult = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'almc_suporte = true && almc_status = "pending"'
      });
      console.log(`   âœ… SolicitaÃ§Ãµes ALMC: ${almcResult.totalItems}`);
      
      if (almcResult.totalItems > 0) {
        almcResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. "${item.title}"`);
        });
      }
      
    } catch (error) {
      console.log(`   âŒ Erro ao buscar ALMC: ${error.message}`);
    }
    
    console.log('\n3. Buscando solicitaÃ§Ãµes TRA (igual ao useNotifications):');
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
      console.log(`   âŒ Erro ao buscar TRA: ${error.message}`);
    }
    
    // Simular o cÃ¡lculo do unreadCount
    console.log('\n4. Simulando cÃ¡lculo do unreadCount:');
    
    // Pegar os resultados anteriores
    let systemUnread = 0;
    let almcTotal = 0;
    let traTotal = 0;
    
    try {
      const notifResult = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
        filter: `user = "${userId}"`
      });
      systemUnread = notifResult.items.filter(n => !n.read).length;
    } catch (error) {
      console.log(`   NotificaÃ§Ãµes erro: ${error.message}`);
    }
    
    try {
      const almcResult = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'almc_suporte = true && almc_status = "pending"'
      });
      almcTotal = almcResult.totalItems;
    } catch (error) {
      console.log(`   ALMC erro: ${error.message}`);
    }
    
    try {
      const traResult = await pb.collection('agenda_cap53_eventos').getList(1, 50, {
        filter: 'transporte_suporte = true && transporte_status = "pending"'
      });
      traTotal = traResult.totalItems;
    } catch (error) {
      console.log(`   TRA erro: ${error.message}`);
    }
    
    const totalCount = systemUnread + almcTotal + traTotal;
    console.log(`   ðŸ“Š CÃ¡lculo final: ${systemUnread} (sistema) + ${almcTotal} (ALMC) + ${traTotal} (TRA) = ${totalCount}`);
    
  } catch (error) {
    console.error('âŒ Erro geral:', error.message);
  }
}

debugUseNotificationsLogic();
