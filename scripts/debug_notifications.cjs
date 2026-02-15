const { pb } = require('./test_connection_simple.cjs');

async function debugNotifications() {
  try {
    console.log('🔍 Debug de Notificações do Almoxarifado\n');
    
    // 1. Buscar usuário Almoxarifado
    console.log('1. Buscando usuário Almoxarifado...');
    const almcUsers = await pb.collection('users').getList(1, 10, {
      filter: 'role = "ALMC"'
    });
    
    if (almcUsers.items.length === 0) {
      console.log('❌ Nenhum usuário Almoxarifado encontrado');
      return;
    }
    
    const almcUser = almcUsers.items[0];
    console.log(`✅ Usuário Almoxarifado: ${almcUser.email} (ID: ${almcUser.id})`);
    
    // 2. Buscar notificações para este usuário
    console.log('\n2. Buscando notificações para este usuário...');
    const notifications = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
      filter: `user = "${almcUser.id}"`,
      sort: '-created',
      expand: 'event,related_request,related_request.item'
    });
    
    console.log(`📊 Total de notificações: ${notifications.totalItems}`);
    
    if (notifications.items.length > 0) {
      notifications.items.forEach((notif, index) => {
        console.log(`\n${index + 1}. Notificação:`);
        console.log(`   ID: ${notif.id}`);
        console.log(`   Título: ${notif.title}`);
        console.log(`   Mensagem: ${notif.message}`);
        console.log(`   Tipo: ${notif.type}`);
        console.log(`   Lida: ${notif.read}`);
        console.log(`   Status: ${notif.invite_status}`);
        console.log(`   Criada: ${new Date(notif.created).toLocaleString()}`);
        if (notif.expand?.event) {
          console.log(`   Evento: ${notif.expand.event.title}`);
        }
        if (notif.expand?.related_request?.expand?.item) {
          console.log(`   Item: ${notif.expand.related_request.expand.item.name}`);
        }
      });
    } else {
      console.log('❌ Nenhuma notificação encontrada para este usuário');
    }
    
    // 3. Buscar solicitações pendentes ALMC
    console.log('\n3. Buscando solicitações pendentes ALMC...');
    const almcRequests = await pb.collection('agenda_cap53_almac_requests').getList(1, 50, {
      filter: 'status = "pending" && (item.category = "ALMOXARIFADO" || item.category = "COPA")',
      expand: 'item,event,created_by'
    });
    
    console.log(`📊 Total de solicitações pendentes: ${almcRequests.totalItems}`);
    
    if (almcRequests.items.length > 0) {
      almcRequests.items.forEach((req, index) => {
        console.log(`\n${index + 1}. Solicitação:`);
        console.log(`   ID: ${req.id}`);
        console.log(`   Evento: ${req.expand?.event?.title || 'N/A'}`);
        console.log(`   Item: ${req.expand?.item?.name || 'N/A'}`);
        console.log(`   Quantidade: ${req.quantity}`);
        console.log(`   Criada por: ${req.expand?.created_by?.email || 'N/A'}`);
        console.log(`   Criada em: ${new Date(req.created).toLocaleString()}`);
      });
    }
    
    // 4. Verificar últimas notificações criadas (todas)
    console.log('\n4. Buscando últimas notificações criadas (todas)...');
    const allNotifications = await pb.collection('agenda_cap53_notifications').getList(1, 10, {
      sort: '-created',
      expand: 'user'
    });
    
    console.log(`📊 Total geral de notificações: ${allNotifications.totalItems}`);
    
    if (allNotifications.items.length > 0) {
      console.log('\nÚltimas 10 notificações:');
      allNotifications.items.forEach((notif, index) => {
        console.log(`\n${index + 1}. Notificação:`);
        console.log(`   ID: ${notif.id}`);
        console.log(`   Usuário: ${notif.expand?.user?.email || notif.user}`);
        console.log(`   Título: ${notif.title}`);
        console.log(`   Tipo: ${notif.type}`);
        console.log(`   Criada: ${new Date(notif.created).toLocaleString()}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao debugar notificações:', error.message);
  }
}

debugNotifications();