const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function verifyNotification() {
  try {
    console.log('🔍 Verificando notificações no banco remoto...');
    
    // Buscar notificações para o usuário ALMC
    const notifications = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
      filter: 'user = "qsi3qe4dn3peo51"',
      sort: '-created',
      expand: 'user,event,related_request,related_request.item'
    });
    
    console.log(`📊 Total de notificações encontradas: ${notifications.totalItems}`);
    
    if (notifications.totalItems > 0) {
      console.log('📋 Notificações encontradas:');
      notifications.items.forEach((notif, index) => {
        console.log(`${index + 1}. ID: ${notif.id}`);
        console.log(`   Título: ${notif.title}`);
        console.log(`   Mensagem: ${notif.message}`);
        console.log(`   Tipo: ${notif.type}`);
        console.log(`   Lida: ${notif.read}`);
        console.log(`   Criada: ${notif.created}`);
        console.log(`   Usuário: ${notif.expand?.user?.name || notif.user}`);
        console.log(`   Evento: ${notif.expand?.event?.title || notif.event}`);
        console.log(`   Item: ${notif.expand?.related_request?.expand?.item?.name || 'N/A'}`);
        console.log('   ---');
      });
    } else {
      console.log('❌ Nenhuma notificação encontrada para este usuário');
    }
    
    // Verificar especificamente a notificação que acabamos de criar
    console.log('\n🔍 Verificando notificação específica ID: 98qohs3v6ofot7e');
    try {
      const specificNotif = await pb.collection('agenda_cap53_notifications').getOne('98qohs3v6ofot7e', {
        expand: 'user,event,related_request,related_request.item'
      });
      console.log('✅ Notificação encontrada!');
      console.log('📋 Detalhes:', {
        id: specificNotif.id,
        title: specificNotif.title,
        message: specificNotif.message,
        type: specificNotif.type,
        read: specificNotif.read,
        user: specificNotif.expand?.user?.name,
        event: specificNotif.expand?.event?.title,
        item: specificNotif.expand?.related_request?.expand?.item?.name
      });
    } catch (error) {
      console.log('❌ Notificação específica não encontrada:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar notificações:', error.message);
  }
}

verifyNotification();