
const PocketBase = require('pocketbase/cjs');

async function checkData() {
  const pb = new PocketBase('https://centraldedados.duckdns.org');
  
  try {
    console.log('Attempting to fetch records from agenda_cap53_eventos...');
    const records = await pb.collection('agenda_cap53_eventos').getList(1, 5);
    
    console.log(`Total items found: ${records.totalItems}`);
    if (records.items.length === 0) {
      console.log('No records visible. This could mean:');
      console.log('1. The collection is empty.');
      console.log('2. API Rules restrict access (e.g., listRule is not null/empty).');
    }
    
    records.items.forEach(r => {
      console.log(`ID: ${r.id}, Title: ${r.title}`);
    });

  } catch (err) {
    console.error('Error fetching data:', err.status, err.message);
  }
}

checkData();
