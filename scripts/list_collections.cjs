const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.duckdns.org');

async function listAllCollections() {
  try {
    console.log('🔍 Listando todas as coleções disponíveis...');
    
    const collections = await pb.collections.getFullList();
    
    console.log(`\n✅ Encontradas ${collections.length} coleções:`);
    collections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name} (${collection.type})`);
      console.log(`   - Descrição: ${collection.schema?.length || 0} campos`);
    });
    
    // Filtrar coleções que contenham "request" ou "almc" ou "notification"
    console.log('\n🔍 Coleções relevantes para notificações:');
    const relevantCollections = collections.filter(col => 
      col.name.toLowerCase().includes('request') || 
      col.name.toLowerCase().includes('almc') || 
      col.name.toLowerCase().includes('notification') ||
      col.name.toLowerCase().includes('event')
    );
    
    if (relevantCollections.length > 0) {
      relevantCollections.forEach((collection, index) => {
        console.log(`${index + 1}. ${collection.name}`);
      });
    } else {
      console.log('❌ Nenhuma coleção relevante encontrada');
    }
    
    // Verificar schema de algumas coleções importantes
    console.log('\n🔍 Verificando schemas...');
    
    for (const collection of relevantCollections.slice(0, 3)) {
      try {
        const fullCollection = await pb.collections.getOne(collection.id);
        console.log(`\n📋 ${collection.name}:`);
        fullCollection.schema.forEach(field => {
          console.log(`   - ${field.name}: ${field.type}${field.required ? ' (obrigatório)' : ''}`);
        });
      } catch (error) {
        console.log(`   ❌ Erro ao obter schema de ${collection.name}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao listar coleções:', error.message);
  }
}

listAllCollections();