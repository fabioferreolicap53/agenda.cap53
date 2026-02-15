// Script para testar health check do hook
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function testHookHealth() {
  try {
    console.log('🧪 Testando health check do hook...');
    
    // Testar endpoint de health do hook
    const result = await pb.send('/api/hooks_health', {
      method: 'GET'
    });
    
    console.log('✅ Hook está carregado:', result);
    
  } catch (error) {
    console.log('❌ Hook health check falhou:', error.status, error.message);
    
    if (error.status === 404) {
      console.log('📝 O hook notifications.pb.js não está sendo carregado');
      console.log('📝 Verifique se o arquivo está no diretório pb_hooks/');
      console.log('📝 Verifique os logs do PocketBase para erros de carregamento');
    }
  }
}

testHookHealth();