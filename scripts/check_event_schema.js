const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_EMAIL || 'admin@admin.com';
const ADMIN_PASS = process.env.PB_PASS || '1234567890';

async function run() {
    console.log(`🔍 Verificando Schema de Eventos em ${PB_URL}...`);
    
    // Autenticar Admin
    let authRes;
    try {
        authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
        });
    } catch (e) { console.error('❌ Erro de conexão'); return; }
    
    if (!authRes.ok) { console.error('❌ Falha Auth Admin'); return; }
    const token = (await authRes.json()).token;

    // Buscar Detalhes da Coleção
    const colRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_eventos`, {
        headers: { 'Authorization': token }
    });
    
    if (!colRes.ok) {
        console.error('❌ Coleção não encontrada!');
        return;
    }

    const collection = await colRes.json();
    console.log(`\n📂 Coleção: ${collection.name}`);
    console.log('📋 Campos (Schema):');
    collection.schema.forEach(field => {
        if (field.name === 'status') {
            console.log(`   - [${field.name}] (${field.type}) Options:`, field.options);
        } else {
            console.log(`   - [${field.name}] (${field.type})`);
        }
    });
}

run();
