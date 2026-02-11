
const PocketBase = require('pocketbase/cjs');

async function getCollectionInfo() {
  const pb = new PocketBase('https://centraldedados.duckdns.org');
  
  try {
    // We can try to get the collection by name
    const collection = await pb.collections.getOne('agenda_cap53_eventos');
    console.log('Collection Schema:');
    console.log(JSON.stringify(collection.schema, null, 2));
    console.log('API Rules:');
    console.log(JSON.stringify({
      listRule: collection.listRule,
      viewRule: collection.viewRule,
      createRule: collection.createRule,
      updateRule: collection.updateRule,
      deleteRule: collection.deleteRule,
    }, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

getCollectionInfo();
