// Script para executar no Console do DevTools
// Isso vai mostrar exatamente o que o frontend está conseguindo acessar

console.log('🔍 Investigando o que o frontend consegue acessar...');

// Verificar se o PocketBase está configurado
if (window.pb) {
  console.log('✅ PocketBase está disponível no window.pb');
  console.log('📍 URL base:', window.pb.baseUrl);
  console.log('🔑 Autenticado:', window.pb.authStore.isValid);
  console.log('👤 Usuário:', window.pb.authStore.model?.id, window.pb.authStore.model?.email);
} else {
  console.log('❌ PocketBase não está disponível no window');
}

// Função para testar acessos
async function testFrontendAccess() {
  try {
    console.log('\n🔍 Testando acessos do frontend...');
    
    const pb = window.pb;
    if (!pb) {
      console.log('❌ PocketBase não disponível');
      return;
    }
    
    // Testar notificações
    console.log('1. Testando notificações...');
    try {
      const notifications = await pb.collection('agenda_cap53_notifications').getList(1, 1, {
        filter: `user = "${pb.authStore.model?.id}"`
      });
      console.log(`   ✅ Notificações: ${notifications.totalItems} encontradas`);
    } catch (error) {
      console.log(`   ❌ Erro notificações: ${error.message}`);
    }
    
    // Testar requests
    console.log('2. Testando requests...');
    try {
      const requests = await pb.collection('agenda_cap53_requests').getList(1, 1);
      console.log(`   ✅ Requests: ${requests.totalItems} encontradas`);
    } catch (error) {
      console.log(`   ❌ Erro requests: ${error.message}`);
    }
    
    // Testar eventos
    console.log('3. Testando eventos...');
    try {
      const events = await pb.collection('agenda_cap53_eventos').getList(1, 1);
      console.log(`   ✅ Eventos: ${events.totalItems} encontradas`);
    } catch (error) {
      console.log(`   ❌ Erro eventos: ${error.message}`);
    }
    
    // Testar queries específicas do useNotifications
    console.log('4. Testando queries do useNotifications...');
    
    // Query ALMC
    try {
      const almcResult = await pb.collection('agenda_cap53_requests').getList(1, 1, {
        filter: 'status = "pending" && (item.category = "ALMOXARIFADO" || item.category = "COPA")'
      });
      console.log(`   ✅ Query ALMC: ${almcResult.totalItems} resultados`);
    } catch (error) {
      console.log(`   ❌ Erro query ALMC: ${error.message}`);
    }
    
    // Query TRA
    try {
      const traResult = await pb.collection('agenda_cap53_eventos').getList(1, 1, {
        filter: 'transporte_suporte = true && transporte_status = "pending"'
      });
      console.log(`   ✅ Query TRA: ${traResult.totalItems} resultados`);
    } catch (error) {
      console.log(`   ❌ Erro query TRA: ${error.message}`);
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

// Executar teste
testFrontendAccess();

// Verificar o estado atual do useNotifications
console.log('\n🔍 Verificando estado do useNotifications...');

// Procurar por hooks ou estado
setTimeout(() => {
  // Verificar se há algum estado global
  const allKeys = Object.keys(window);
  const stateKeys = allKeys.filter(key => key.toLowerCase().includes('state') || key.toLowerCase().includes('hook'));
  
  if (stateKeys.length > 0) {
    console.log('🔑 Possíveis estados encontrados:', stateKeys);
  }
  
  console.log('\n✅ Verificação completa!');
}, 1000);