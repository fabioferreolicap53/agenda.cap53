const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_EMAIL || 'admin@admin.com';
const ADMIN_PASS = process.env.PB_PASS || '1234567890';

async function run() {
    console.log(`🔍 Verificando Schema de Requests...`);
    
    // Autenticar
    const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    const token = (await authRes.json()).token;

    // Buscar Schema de ALMAC
    const colRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_almac_requests`, {
        headers: { 'Authorization': token }
    });
    
    const collection = await colRes.json();
    console.log(`\n📂 Coleção: ${collection.name}`);
    console.log('📋 Campos (Schema):');
    collection.schema.forEach(field => {
        console.log(`   - [${field.name}] (${field.type})`);
    });
}
run();
