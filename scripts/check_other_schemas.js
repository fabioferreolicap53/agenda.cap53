const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_EMAIL || 'admin@admin.com';
const ADMIN_PASS = process.env.PB_PASS || '1234567890';

async function run() {
    console.log(`🔍 Verificando Schemas de DCA e Transporte...`);
    
    // Autenticar
    const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    const token = (await authRes.json()).token;

    const collections = ['agenda_cap53_dca_requests', 'agenda_cap53_transporte_requests'];

    for (const name of collections) {
        const colRes = await fetch(`${PB_URL}/api/collections/${name}`, {
            headers: { 'Authorization': token }
        });
        
        if (colRes.ok) {
            const collection = await colRes.json();
            console.log(`\n📂 Coleção: ${collection.name}`);
            console.log('📋 Campos:');
            collection.schema.forEach(field => {
                if (field.name === 'quantity' || field.name === 'amount' || field.name === 'passengers') {
                    console.log(`   - [${field.name}] (${field.type})`);
                }
            });
        } else {
            console.log(`\n❌ Coleção ${name} não encontrada.`);
        }
    }
}
run();
