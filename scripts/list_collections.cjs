const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function listAllCollections() {
  try {
    console.log('ðŸ” Listando todas as coleÃ§Ãµes disponÃ­veis...');
    
    const collections = await pb.collections.getFullList();
    
    console.log(`\nâœ… Encontradas ${collections.length} coleÃ§Ãµes:`);
    collections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name} (${collection.type})`);
      console.log(`   - DescriÃ§Ã£o: ${collection.schema?.length || 0} campos`);
    });
    
    // Filtrar coleÃ§Ãµes que contenham "request" ou "almc" ou "notification"
    console.log('\nðŸ” ColeÃ§Ãµes relevantes para notificaÃ§Ãµes:');
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
      console.log('âŒ Nenhuma coleÃ§Ã£o relevante encontrada');
    }
    
    // Verificar schema de algumas coleÃ§Ãµes importantes
    console.log('\nðŸ” Verificando schemas...');
    
    for (const collection of relevantCollections.slice(0, 3)) {
      try {
        const fullCollection = await pb.collections.getOne(collection.id);
        console.log(`\nðŸ“‹ ${collection.name}:`);
        fullCollection.schema.forEach(field => {
          console.log(`   - ${field.name}: ${field.type}${field.required ? ' (obrigatÃ³rio)' : ''}`);
        });
      } catch (error) {
        console.log(`   âŒ Erro ao obter schema de ${collection.name}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('âŒ Erro ao listar coleÃ§Ãµes:', error.message);
  }
}

listAllCollections();
