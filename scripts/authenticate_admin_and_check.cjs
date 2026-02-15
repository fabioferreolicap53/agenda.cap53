const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function authenticateAndListCollections() {
  try {
    console.log('🔐 Autenticando como admin...');
    
    // Autenticar como admin
    try {
      await pb.admins.authWithPassword('admin@cap53.com', 'admin123');
      console.log('✅ Admin autenticado com sucesso!');
    } catch (error) {
      console.log('❌ Erro ao autenticar admin:', error.message);
      console.log('🔍 Tentando com outras credenciais...');
      
      // Tentar com outro admin
      try {
        await pb.admins.authWithPassword('admin@example.com', 'admin123');
        console.log('✅ Admin autenticado com sucesso!');
      } catch (error2) {
        console.log('❌ Erro ao autenticar com outro admin:', error2.message);
        return;
      }
    }
    
    console.log('\n🔍 Listando coleções...');
    const collections = await pb.collections.getFullList();
    
    console.log(`\n✅ Encontradas ${collections.length} coleções:`);
    
    // Procurar coleções específicas
    const agendaCollections = collections.filter(col => col.name.startsWith('agenda_cap53_'));
    console.log(`\n📋 Coleções do agenda (${agendaCollections.length}):`);
    agendaCollections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name}`);
    });
    
    // Verificar se existe requests
    const requestsCollection = collections.find(col => col.name === 'agenda_cap53_requests');
    if (requestsCollection) {
      console.log('\n✅ Coleção agenda_cap53_requests existe!');
      
      // Verificar schema
      const fullCollection = await pb.collections.getOne(requestsCollection.id);
      console.log('📋 Schema:');
      fullCollection.schema.forEach(field => {
        console.log(`   - ${field.name}: ${field.type}${field.required ? ' (obrigatório)' : ''}`);
      });
      
    } else {
      console.log('\n❌ Coleção agenda_cap53_requests NÃO existe!');
      
      // Verificar se existe algo similar
      const similarCollections = collections.filter(col => 
        col.name.includes('request') || 
        col.name.includes('item') || 
        col.name.includes('almc')
      );
      
      if (similarCollections.length > 0) {
        console.log('\n🔍 Coleções similares encontradas:');
        similarCollections.forEach(col => console.log(`   - ${col.name}`));
      }
    }
    
    // Ver eventos
    const eventosCollection = collections.find(col => col.name === 'agenda_cap53_eventos');
    if (eventosCollection) {
      console.log('\n✅ Coleção agenda_cap53_eventos existe!');
      
      // Ver campos de suporte
      const fullCollection = await pb.collections.getOne(eventosCollection.id);
      const suporteFields = fullCollection.schema.filter(field => 
        field.name.includes('suporte') || 
        field.name.includes('status')
      );
      
      if (suporteFields.length > 0) {
        console.log('📋 Campos de suporte/status:');
        suporteFields.forEach(field => {
          console.log(`   - ${field.name}: ${field.type}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

authenticateAndListCollections();