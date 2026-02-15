// Script para verificar estrutura do banco de dados
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function checkDatabaseStructure() {
  try {
    console.log('🔍 Verificando estrutura do banco de dados...');
    
    // Verificar coleções principais
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
        console.log(`✅ ${collectionName}: ${result.totalItems} registros`);
      } catch (error) {
        console.log(`❌ ${collectionName}: Erro - ${error.message}`);
      }
    }
    
    console.log('\n📝 Para testar o sistema de notificações:');
    console.log('1. Acesse http://localhost:3002');
    console.log('2. Faça login com suas credenciais');
    console.log('3. Crie um novo evento');
    console.log('4. Adicione itens ao evento');
    console.log('5. Verifique as notificações na página de Notificações');
    
    console.log('\n🔧 O sistema de debug está ativado e irá mostrar:');
    console.log('- Logs no console do navegador');
    console.log('- Botão de debug na página de Notificações');
    console.log('- Notificações salvas no localStorage');
    
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error.message);
  }
}

checkDatabaseStructure();