// Script para testar health check do hook
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function testHookHealth() {
  try {
    console.log('ðŸ§ª Testando health check do hook...');
    
    // Testar endpoint de health do hook
    const result = await pb.send('/api/hooks_health', {
      method: 'GET'
    });
    
    console.log('âœ… Hook estÃ¡ carregado:', result);
    
  } catch (error) {
    console.log('âŒ Hook health check falhou:', error.status, error.message);
    
    if (error.status === 404) {
      console.log('ðŸ“ O hook notifications.pb.js nÃ£o estÃ¡ sendo carregado');
      console.log('ðŸ“ Verifique se o arquivo estÃ¡ no diretÃ³rio pb_hooks/');
      console.log('ðŸ“ Verifique os logs do PocketBase para erros de carregamento');
    }
  }
}

testHookHealth();
