// Script para testar o endpoint de sincronização localmente
import { pb } from '../lib/pocketbase.js';

async function testSyncEndpoint() {
  try {
    console.log('Testando endpoint de sincronização...');
    
    // Testar se o endpoint existe
    const result = await pb.send('/api/sync_event_notifications', {
      method: 'POST',
      body: { event_id: 'test_event_123' }
    });
    
    console.log('✅ Endpoint funcionando:', result);
  } catch (error) {
    console.log('❌ Endpoint falhou:', error.status, error.message);
    
    if (error.status === 404) {
      console.log('📝 O endpoint não está registrado no PocketBase');
      console.log('📝 Verifique os logs do PocketBase para ver se os hooks foram carregados');
    }
  }
}

testSyncEndpoint();