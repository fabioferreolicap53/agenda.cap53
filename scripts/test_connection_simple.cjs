// Script simples para testar conexão com PocketBase
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('http://localhost:8090');

async function testConnection() {
  try {
    console.log('🧪 Testando conexão com PocketBase...');
    
    // Testar se o servidor está respondendo
    const health = await pb.health.check();
    console.log('✅ PocketBase está rodando:', health);
    
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
      }
    }
    
  } catch (error) {
    console.log('❌ PocketBase não está acessível:', error.message);
    console.log('📝 Certifique-se de que o PocketBase está rodando em http://localhost:8090');
  }
}

testConnection();