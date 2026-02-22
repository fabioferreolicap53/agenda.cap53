const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function verifyNotification() {
  try {
    console.log('ðŸ” Verificando notificaÃ§Ãµes no banco remoto...');
    
    // Buscar notificaÃ§Ãµes para o usuÃ¡rio ALMC
    const notifications = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
      filter: 'user = "qsi3qe4dn3peo51"',
      sort: '-created',
      expand: 'user,event,related_request,related_request.item'
    });
    
    console.log(`ðŸ“Š Total de notificaÃ§Ãµes encontradas: ${notifications.totalItems}`);
    
    if (notifications.totalItems > 0) {
      console.log('ðŸ“‹ NotificaÃ§Ãµes encontradas:');
      notifications.items.forEach((notif, index) => {
        console.log(`${index + 1}. ID: ${notif.id}`);
        console.log(`   TÃ­tulo: ${notif.title}`);
        console.log(`   Mensagem: ${notif.message}`);
        console.log(`   Tipo: ${notif.type}`);
        console.log(`   Lida: ${notif.read}`);
        console.log(`   Criada: ${notif.created}`);
        console.log(`   UsuÃ¡rio: ${notif.expand?.user?.name || notif.user}`);
        console.log(`   Evento: ${notif.expand?.event?.title || notif.event}`);
        console.log(`   Item: ${notif.expand?.related_request?.expand?.item?.name || 'N/A'}`);
        console.log('   ---');
      });
    } else {
      console.log('âŒ Nenhuma notificaÃ§Ã£o encontrada para este usuÃ¡rio');
    }
    
    // Verificar especificamente a notificaÃ§Ã£o que acabamos de criar
    console.log('\nðŸ” Verificando notificaÃ§Ã£o especÃ­fica ID: 98qohs3v6ofot7e');
    try {
      const specificNotif = await pb.collection('agenda_cap53_notifications').getOne('98qohs3v6ofot7e', {
        expand: 'user,event,related_request,related_request.item'
      });
      console.log('âœ… NotificaÃ§Ã£o encontrada!');
      console.log('ðŸ“‹ Detalhes:', {
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
      console.log('âŒ NotificaÃ§Ã£o especÃ­fica nÃ£o encontrada:', error.message);
    }
    
  } catch (error) {
    console.error('âŒ Erro ao verificar notificaÃ§Ãµes:', error.message);
  }
}

verifyNotification();
