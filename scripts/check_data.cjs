
const PocketBase = require('pocketbase/cjs');

async function checkData() {
  const pb = new PocketBase('https://centraldedados.duckdns.org');
  
  try {
    // We don't have credentials here, but maybe we can list if rules allow
    // or we can try to find an event to see its structure
    const records = await pb.collection('agenda_cap53_eventos').getList(1, 5, {
      sort: '-created'
    });
    
    console.log('Sample records:');
    records.items.forEach(r => {
      console.log(`ID: ${r.id}`);
      console.log(`Title: ${r.title}`);
      console.log(`Units: ${JSON.stringify(r.unidades)}`);
      console.log(`Categories: ${JSON.stringify(r.categorias_profissionais)}`);
      console.log(`Start: ${r.date_start}, End: ${r.date_end}`);
      console.log('---');
    });
  } catch (err) {
    console.error('Error fetching data:', err.message);
    if (err.data) console.error('Error data:', JSON.stringify(err.data));
  }
}

checkData();
