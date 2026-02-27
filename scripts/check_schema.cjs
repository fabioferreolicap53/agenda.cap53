const PocketBase = require('pocketbase/cjs');
const https = require('https');

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function checkSchema() {
    console.log('Iniciando checkSchema...');
    const pb = new PocketBase('https://centraldedados.dev.br');
    try {
        const endpoints = ['/api/superusers/auth-with-password', '/api/admins/auth-with-password'];
        let authenticated = false;
        for (const endpoint of endpoints) {
            console.log(`Tentando autenticar em ${endpoint}...`);
            try {
                const res = await fetch('https://centraldedados.dev.br' + endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identity: 'fabioferreoli@gmail.com', password: '@Cap5364125' })
                });
                if (res.ok) {
                    const data = await res.json();
                    pb.authStore.save(data.token, data.admin || data.superuser);
                    authenticated = true;
                    console.log('Autenticado com sucesso.');
                    break;
                } else {
                    console.log(`Falha na autenticação em ${endpoint}: ${res.status}`);
                }
            } catch (e) {
                console.error(`Erro durante fetch para ${endpoint}:`, e.message);
            }
        }
        if (!authenticated) {
            console.error('Auth failed');
            return;
        }
        console.log('Buscando coleções...');
        const collections = await pb.collections.getFullList();
        const col = collections.find(c => c.name === 'agenda_cap53_participantes');
        if (col) {
            console.log('Schema da coleção agenda_cap53_participantes:');
            console.log(JSON.stringify(col.schema, null, 2));
        } else {
            console.log('Coleção agenda_cap53_participantes não encontrada.');
        }
    } catch (e) {
        console.error('Erro inesperado:', e);
    }
}
checkSchema();
