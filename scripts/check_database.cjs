// Script para verificar estrutura do banco de dados
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function checkDatabaseStructure() {
  try {
    console.log('ðŸ” Verificando estrutura do banco de dados...');
    
    // Verificar coleÃ§Ãµes principais
    const collections = [
      'agenda_cap53_eventos',
      'agenda_cap53_itens_servico', 
      'agenda_cap53_almac_requests',
      'agenda_cap53_notifications',
      'agenda_cap53_usuarios',
      'agenda_cap53_locais'
    ];
    
    for (const collectionName of collections) {
      try {
        const result = await pb.collection(collectionName).getList(1, 1);
        console.log(`âœ… ${collectionName}: ${result.totalItems} registros`);
      } catch (error) {
        console.log(`âŒ ${collectionName}: Erro - ${error.message}`);
      }
    }
    
    console.log('\nðŸ“ Para testar o sistema de notificaÃ§Ãµes:');
    console.log('1. Acesse http://localhost:3002');
    console.log('2. FaÃ§a login com suas credenciais');
    console.log('3. Crie um novo evento');
    console.log('4. Adicione itens ao evento');
    console.log('5. Verifique as notificaÃ§Ãµes na pÃ¡gina de NotificaÃ§Ãµes');
    
    console.log('\nðŸ”§ O sistema de debug estÃ¡ ativado e irÃ¡ mostrar:');
    console.log('- Logs no console do navegador');
    console.log('- BotÃ£o de debug na pÃ¡gina de NotificaÃ§Ãµes');
    console.log('- NotificaÃ§Ãµes salvas no localStorage');
    
  } catch (error) {
    console.error('âŒ Erro ao verificar estrutura:', error.message);
  }
}

checkDatabaseStructure();
