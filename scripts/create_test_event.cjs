// Script para criar evento de teste e verificar notificaÃ§Ãµes
const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function createTestEvent() {
  try {
    console.log('ðŸ§ª Criando evento de teste...');
    
    // Primeiro, vamos buscar itens disponÃ­veis
    const items = await pb.collection('agenda_cap53_itens_servico').getList(1, 5);
    console.log(`ðŸ“¦ Encontrados ${items.items.length} itens`);
    
    if (items.items.length === 0) {
      console.log('âŒ Nenhum item encontrado para testar');
      return;
    }
    
    // Buscar locais disponÃ­veis
    const locations = await pb.collection('agenda_cap53_locais').getList(1, 5);
    console.log(`ðŸ“ Encontrados ${locations.items.length} locais`);
    
    // Criar evento de teste
    const testEvent = {
      title: 'Evento de Teste - NotificaÃ§Ãµes',
      description: 'Evento criado para testar sistema de notificaÃ§Ãµes de itens',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // AmanhÃ£
      time: '14:00',
      duration: 120,
      location: locations.items[0]?.id || 'default_location',
      user: 'test_user_id', // Vamos precisar autenticar ou usar um ID vÃ¡lido
      status: 'pending',
      participants: [],
      transport_needed: false,
      almc_items: []
    };
    
    console.log('ðŸ“… Criando evento:', testEvent.title);
    
    // Como nÃ£o temos autenticaÃ§Ã£o, vamos apenas simular o processo
    console.log('ðŸ“ Simulando criaÃ§Ã£o de evento...');
    console.log('ðŸ“ Itens que seriam solicitados:');
    
    items.items.slice(0, 2).forEach(item => {
      console.log(`  - ${item.name} (${item.category}) - Quantidade: 5`);
    });
    
    // Simular criaÃ§Ã£o de pedidos
    console.log('ðŸ“ Simulando pedidos de itens...');
    
    items.items.slice(0, 2).forEach(item => {
      console.log(`ðŸ“ Criando pedido para item: ${item.name} (${item.category})`);
      
      // Determinar setor alvo
      const targetRole = item.category === 'INFORMATICA' ? 'DCA' : 'ALMC';
      console.log(`ðŸŽ¯ Setor alvo: ${targetRole}`);
      
      // Simular criaÃ§Ã£o de notificaÃ§Ã£o
      console.log(`ðŸ”” NotificaÃ§Ã£o seria criada para usuÃ¡rios do setor ${targetRole}`);
    });
    
    console.log('âœ… SimulaÃ§Ã£o concluÃ­da!');
    console.log('ðŸ“ Para testar realmente, vocÃª precisa:');
    console.log('  1. Fazer login no sistema');
    console.log('  2. Criar um evento atravÃ©s da interface');
    console.log('  3. Adicionar itens ao evento');
    console.log('  4. Verificar as notificaÃ§Ãµes criadas');
    
  } catch (error) {
    console.error('âŒ Erro no teste:', error.message);
  }
}

createTestEvent();
