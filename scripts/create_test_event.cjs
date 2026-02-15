// Script para criar evento de teste e verificar notificações
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function createTestEvent() {
  try {
    console.log('🧪 Criando evento de teste...');
    
    // Primeiro, vamos buscar itens disponíveis
    const items = await pb.collection('agenda_cap53_itens_servico').getList(1, 5);
    console.log(`📦 Encontrados ${items.items.length} itens`);
    
    if (items.items.length === 0) {
      console.log('❌ Nenhum item encontrado para testar');
      return;
    }
    
    // Buscar locais disponíveis
    const locations = await pb.collection('agenda_cap53_locais').getList(1, 5);
    console.log(`📍 Encontrados ${locations.items.length} locais`);
    
    // Criar evento de teste
    const testEvent = {
      title: 'Evento de Teste - Notificações',
      description: 'Evento criado para testar sistema de notificações de itens',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Amanhã
      time: '14:00',
      duration: 120,
      location: locations.items[0]?.id || 'default_location',
      user: 'test_user_id', // Vamos precisar autenticar ou usar um ID válido
      status: 'pending',
      participants: [],
      transport_needed: false,
      almc_items: []
    };
    
    console.log('📅 Criando evento:', testEvent.title);
    
    // Como não temos autenticação, vamos apenas simular o processo
    console.log('📝 Simulando criação de evento...');
    console.log('📝 Itens que seriam solicitados:');
    
    items.items.slice(0, 2).forEach(item => {
      console.log(`  - ${item.name} (${item.category}) - Quantidade: 5`);
    });
    
    // Simular criação de pedidos
    console.log('📝 Simulando pedidos de itens...');
    
    items.items.slice(0, 2).forEach(item => {
      console.log(`📝 Criando pedido para item: ${item.name} (${item.category})`);
      
      // Determinar setor alvo
      const targetRole = item.category === 'INFORMATICA' ? 'DCA' : 'ALMC';
      console.log(`🎯 Setor alvo: ${targetRole}`);
      
      // Simular criação de notificação
      console.log(`🔔 Notificação seria criada para usuários do setor ${targetRole}`);
    });
    
    console.log('✅ Simulação concluída!');
    console.log('📝 Para testar realmente, você precisa:');
    console.log('  1. Fazer login no sistema');
    console.log('  2. Criar um evento através da interface');
    console.log('  3. Adicionar itens ao evento');
    console.log('  4. Verificar as notificações criadas');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

createTestEvent();