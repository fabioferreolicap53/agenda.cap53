const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function testValidation() {
  try {
    console.log('ðŸ” Testando validaÃ§Ã£o de campos...');
    
    // Testar com dados mÃ­nimos obrigatÃ³rios
    console.log('1. Testando com dados mÃ­nimos...');
    try {
      const minimalTest = await pb.collection('agenda_cap53_notifications').create({
        user: 'qsi3qe4dn3peo51',
        title: 'Teste',
        message: 'Teste',
        type: 'almc_item_request',
        read: false,
        acknowledged: false,
        invite_status: 'pending'  // Adicionando campo que pode ser obrigatÃ³rio
      });
      console.log('âœ… Teste mÃ­nimo: SUCESSO');
      console.log('   ID:', minimalTest.id);
    } catch (error) {
      console.log('âŒ Teste mÃ­nimo: FALHOU');
      console.log('   Erro:', error.message);
      console.log('   CÃ³digo:', error.status);
      if (error.data && error.data.data) {
        console.log('   Detalhes de validaÃ§Ã£o:', JSON.stringify(error.data.data, null, 2));
      }
    }
    
    // Testar com todos os campos que usamos
    console.log('\n2. Testando com todos os campos que usamos...');
    try {
      const fullTest = await pb.collection('agenda_cap53_notifications').create({
        user: 'qsi3qe4dn3peo51',
        title: 'SolicitaÃ§Ã£o de Item',
        message: 'O evento "teste" solicitou o item "ÃGUA" (Qtd: 1).',
        type: 'almc_item_request',
        event: 'fp6obwd8ig68267',
        related_request: 'some_request_id',
        read: false,
        acknowledged: false,
        invite_status: 'pending',
        data: { kind: 'almc_item_request', quantity: 1, item: 'some_item_id' }
      });
      console.log('âœ… Teste completo: SUCESSO');
      console.log('   ID:', fullTest.id);
    } catch (error) {
      console.log('âŒ Teste completo: FALHOU');
      console.log('   Erro:', error.message);
      console.log('   CÃ³digo:', error.status);
      if (error.data && error.data.data) {
        console.log('   Detalhes de validaÃ§Ã£o:', JSON.stringify(error.data.data, null, 2));
      }
    }
    
    // Testar campo por campo para identificar o problema
    console.log('\n3. Testando campo por campo...');
    const baseData = {
      user: 'qsi3qe4dn3peo51',
      title: 'Teste',
      message: 'Teste',
      type: 'almc_item_request',
      read: false,
      acknowledged: false
    };
    
    // Testar sem event
    console.log('   3.1 Sem campo event...');
    try {
      await pb.collection('agenda_cap53_notifications').create({
        ...baseData,
        invite_status: 'pending'
      });
      console.log('   âœ… Sem event: SUCESSO');
    } catch (error) {
      console.log('   âŒ Sem event: FALHOU');
    }
    
    // Testar sem related_request
    console.log('   3.2 Sem campo related_request...');
    try {
      await pb.collection('agenda_cap53_notifications').create({
        ...baseData,
        event: 'fp6obwd8ig68267',
        invite_status: 'pending'
      });
      console.log('   âœ… Sem related_request: SUCESSO');
    } catch (error) {
      console.log('   âŒ Sem related_request: FALHOU');
    }
    
  } catch (error) {
    console.error('âŒ Erro geral:', error.message);
  }
}

testValidation();
