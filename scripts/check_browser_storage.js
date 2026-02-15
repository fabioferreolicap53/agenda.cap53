// Script para verificar o que está no localStorage do navegador
// Execute isso no Console do DevTools (F12)

console.log('🔍 Verificando localStorage...');

// Verificar debug_notifications
const debugNotifications = localStorage.getItem('debug_notifications');
console.log('📋 debug_notifications:', debugNotifications ? JSON.parse(debugNotifications) : 'Vazio');

// Verificar se há outros dados relevantes
console.log('📦 Todos os dados do localStorage:');
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
  console.log(`${i + 1}. ${key}:`, value ? value.substring(0, 100) + (value.length > 100 ? '...' : '') : 'Vazio');
}

// Verificar o estado atual do useNotifications (se disponível)
console.log('\n🔍 Verificando estado do React...');

// Tentar acessar o estado global (se houver)
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('✅ React DevTools detectado');
} else {
  console.log('❌ React DevTools não detectado');
}

// Verificar se há alguma variável global com notificações
console.log('\n🔍 Verificando variáveis globais...');
const globalVars = Object.keys(window).filter(key => key.includes('notification') || key.includes('count'));
if (globalVars.length > 0) {
  console.log('Variáveis encontradas:', globalVars);
} else {
  console.log('Nenhuma variável de notificação encontrada');
}

console.log('\n✅ Verificação completa!');
console.log('\n💡 Próximo passo: Criar um evento e monitorar o contador em tempo real');