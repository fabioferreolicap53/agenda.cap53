// Script para testar conexÃ£o com PocketBase remoto
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function testRemoteConnection() {
  try {
    console.log('ðŸ§ª Testando conexÃ£o com PocketBase remoto...');
    console.log('ðŸ“ URL:', pb.baseUrl);
    
    // Testar se o servidor estÃ¡ respondendo
    const health = await pb.health.check();
    console.log('âœ… PocketBase remoto estÃ¡ rodando:', health);
    
    // Testar endpoint de sincronizaÃ§Ã£o
    try {
      const result = await pb.send('/api/sync_event_notifications', {
        method: 'POST',
        body: { event_id: 'test_event_123' }
      });
      console.log('âœ… Endpoint de sincronizaÃ§Ã£o funcionando:', result);
    } catch (error) {
      console.log('âŒ Endpoint de sincronizaÃ§Ã£o falhou:', error.status, error.message);
      
      if (error.status === 404) {
        console.log('ðŸ“ O endpoint /api/sync_event_notifications nÃ£o estÃ¡ registrado');
        console.log('ðŸ“ Verifique se o hook do PocketBase foi carregado corretamente');
        console.log('ðŸ“ Os hooks devem estar em pb_hooks/notifications.pb.js');
      }
    }
    
    // Testar se podemos buscar dados
    try {
      const events = await pb.collection('agenda_cap53_eventos').getList(1, 5);
      console.log(`âœ… Encontrados ${events.items.length} eventos`);
      
      // Buscar pedidos para testar
      const requests = await pb.collection('agenda_cap53_almac_requests').getList(1, 5, {
        expand: 'event,item'
      });
      console.log(`âœ… Encontrados ${requests.items.length} pedidos`);
      
    } catch (dataError) {
      console.log('âŒ Erro ao buscar dados:', dataError.message);
    }
    
  } catch (error) {
    console.log('âŒ PocketBase remoto nÃ£o estÃ¡ acessÃ­vel:', error.message);
    console.log('ðŸ“ Verifique se a VM Oracle estÃ¡ rodando');
    console.log('ðŸ“ URL configurada: https://centraldedados.dev.br');
  }
}

testRemoteConnection();
