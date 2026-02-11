
const PocketBase = require('pocketbase/cjs');

async function testFilter() {
  const pb = new PocketBase('https://centraldedados.duckdns.org');
  
  const testFilters = [
    'categorias_profissionais ?= "ADMINISTRATIVO(A)"',
    'categorias_profissionais ~ "ADMINISTRATIVO(A)"',
    'categorias_profissionais = "ADMINISTRATIVO(A)"'
  ];

  for (const f of testFilters) {
    try {
      console.log(`Testing filter: ${f}`);
      await pb.collection('agenda_cap53_eventos').getList(1, 1, {
        filter: f
      });
      console.log(`✅ Filter "${f}" is valid (or at least didn't throw 400)`);
    } catch (err) {
      console.log(`❌ Filter "${f}" failed: ${err.status} - ${err.message}`);
    }
  }
}

testFilter();
