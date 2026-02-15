// Script para testar conexão com PocketBase remoto
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function testRemoteConnection() {
  try {
    console.log('🧪 Testando conexão com PocketBase remoto...');
    console.log('📍 URL:', pb.baseUrl);
    
    // Testar se o servidor está respondendo
    const health = await pb.health.check();
    console.log('✅ PocketBase remoto está rodando:', health);
    
    // Testar endpoint de sincronização
    try {
      const result = await pb.send('/api/sync_event_notifications', {
        method: 'POST',
        body: { event_id: 'test_event_123' }
      });
      console.log('✅ Endpoint de sincronização funcionando:', result);
    } catch (error) {
      console.log('❌ Endpoint de sincronização falhou:', error.status, error.message);
      
      if (error.status === 404) {
        console.log('📝 O endpoint /api/sync_event_notifications não está registrado');
        console.log('📝 Verifique se o hook do PocketBase foi carregado corretamente');
        console.log('📝 Os hooks devem estar em pb_hooks/notifications.pb.js');
      }
    }
    
    // Testar se podemos buscar dados
    try {
      const events = await pb.collection('agenda_cap53_eventos').getList(1, 5);
      console.log(`✅ Encontrados ${events.items.length} eventos`);
      
      // Buscar pedidos para testar
      const requests = await pb.collection('agenda_cap53_almac_requests').getList(1, 5, {
        expand: 'event,item'
      });
      console.log(`✅ Encontrados ${requests.items.length} pedidos`);
      
    } catch (dataError) {
      console.log('❌ Erro ao buscar dados:', dataError.message);
    }
    
  } catch (error) {
    console.log('❌ PocketBase remoto não está acessível:', error.message);
    console.log('📝 Verifique se a VM Oracle está rodando');
    console.log('📝 URL configurada: https://centraldedados.duckdns.org');
  }
}

testRemoteConnection();