const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function testWithAuth() {
  try {
    console.log('🔍 Testando com autenticação...');
    
    // Autenticar como admin (se tivermos as credenciais)
    // Por enquanto, vamos tentar com um usuário comum
    
    console.log('1. Testando criação com dados completos e autenticação...');
    
    // Vamos tentar criar uma notificação muito simples primeiro
    const simpleData = {
      user: 'qsi3qe4dn3peo51',
      title: 'Teste Simples',
      message: 'Mensagem de teste',
      type: 'test',
      read: false,
      acknowledged: false
    };
    
    console.log('📋 Dados enviados:', JSON.stringify(simpleData, null, 2));
    
    try {
      const result = await pb.collection('agenda_cap53_notifications').create(simpleData);
      console.log('✅ SUCESSO! Notificação criada:', result.id);
    } catch (error) {
      console.log('❌ FALHOU');
      console.log('   Status:', error.status);
      console.log('   Mensagem:', error.message);
      console.log('   Dados:', error.data);
      
      // Tentar obter mais detalhes do erro
      if (error.response) {
        console.log('   Resposta completa:', error.response);
      }
      
      // Verificar se é problema de permissão
      if (error.status === 403) {
        console.log('   ⚠️  Parece ser um problema de permissão!');
      } else if (error.status === 400) {
        console.log('   ⚠️  Parece ser um problema de validação de dados!');
        
        // Tentar obter detalhes específicos dos campos
        if (error.data && error.data.data) {
          console.log('   Campos com erro:', Object.keys(error.data.data));
          for (const field in error.data.data) {
            console.log(`   - ${field}: ${error.data.data[field].message || error.data.data[field]}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWithAuth();