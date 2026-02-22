
const PocketBase = require('pocketbase/cjs');

async function checkData() {
  const pb = new PocketBase('https://centraldedados.dev.br');
  
  try {
    const records = await pb.collection('agenda_cap53_eventos').getList(1, 1);
    if (records.items.length > 0) {
      const r = records.items[0];
      console.log('Record details:');
      console.log(`date_start: "${r.date_start}"`);
      console.log(`date_end: "${r.date_end}"`);
    } else {
      console.log('No records found.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkData();

