// Script para testar o sistema de notificações completamente
import { pb } from '../lib/pocketbase.ts';

async function testNotificationSystem() {
  try {
    console.log('🧪 Iniciando teste do sistema de notificações...');
    
    // 1. Autenticar (se necessário)
    try {
      await pb.collection('agenda_cap53_usuarios').authWithPassword('admin@example.com', 'admin123');
      console.log('✅ Autenticado como admin');
    } catch (authError) {
      console.log('⚠️  Não foi possível autenticar, continuando anonimamente');
    }
    
    // 2. Buscar eventos existentes
    const events = await pb.collection('agenda_cap53_eventos').getList(1, 5);
    console.log(`📅 Encontrados ${events.items.length} eventos`);
    
    if (events.items.length === 0) {
      console.log('❌ Nenhum evento encontrado para testar');
      return;
    }
    
    // 3. Buscar itens disponíveis
    const items = await pb.collection('agenda_cap53_itens_servico').getList(1, 10);
    console.log(`📦 Encontrados ${items.items.length} itens de serviço`);
    
    // 4. Buscar pedidos existentes
    const requests = await pb.collection('agenda_cap53_almac_requests').getList(1, 10, {
      expand: 'event,item'
    });
    console.log(`📝 Encontrados ${requests.items.length} pedidos`);
    
    // 5. Testar sincronização com um evento que tem pedidos
    const eventWithRequests = events.items.find(event => 
      requests.items.some(req => req.event === event.id)
    );
    
    if (eventWithRequests) {
      console.log(`🎯 Testando sincronização com evento: ${eventWithRequests.title} (${eventWithRequests.id})`);
      
      try {
        const syncResult = await pb.send('/api/sync_event_notifications', {
          method: 'POST',
          body: { event_id: eventWithRequests.id }
        });
        
        console.log('✅ Sincronização bem-sucedida:', syncResult);
      } catch (syncError) {
        console.log('❌ Erro na sincronização:', syncError.status, syncError.message);
        
        if (syncError.status === 404) {
          console.log('📝 O endpoint /api/sync_event_notifications não está disponível');
          console.log('📝 Isso indica que o hook do PocketBase não foi carregado corretamente');
        }
      }
    } else {
      console.log('⚠️  Nenhum evento com pedidos encontrado');
    }
    
    // 6. Buscar notificações do usuário atual
    const currentUser = pb.authStore.model;
    if (currentUser) {
      const notifications = await pb.collection('agenda_cap53_notifications').getList(1, 10, {
        filter: `user = "${currentUser.id}"`,
        sort: '-created',
        expand: 'event,related_request,related_request.item'
      });
      
      console.log(`🔔 Encontradas ${notifications.items.length} notificações para o usuário atual`);
      
      notifications.items.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${notif.title} - ${notif.type} - ${notif.read ? 'Lida' : 'Não lida'}`);
        if (notif.expand?.event) {
          console.log(`     Evento: ${notif.expand.event.title}`);
        }
        if (notif.expand?.related_request?.expand?.item) {
          console.log(`     Item: ${notif.expand.related_request.expand.item.name}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testNotificationSystem();