
const pbUrl = 'https://centraldedados.dev.br';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';
const PREFIX = 'agenda_cap53_';

async function debug() {
    console.log('--- Debugging Schema ---');

    try {
        // Auth as Admin
        const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });
        const authData = await authResponse.json();
        const token = authData.token;
        const headers = { 'Content-Type': 'application/json', 'Authorization': token };

        // 1. Get Eventos Schema
        const eventosRes = await fetch(`${pbUrl}/api/collections/${PREFIX}eventos`, { headers });
        const eventosCol = await eventosRes.json();
        
        console.log(`Eventos Collection ID: ${eventosCol.id}`);
        
        const userField = eventosCol.schema.find(f => f.name === 'user');
        console.log('User Field Relation points to Collection ID:', userField.options.collectionId);

        // 2. Get Usuarios Collection
        const usuariosRes = await fetch(`${pbUrl}/api/collections/${PREFIX}usuarios`, { headers });
        const usuariosCol = await usuariosRes.json();
        console.log(`Custom Users Collection (${PREFIX}usuarios) ID: ${usuariosCol.id}`);

        // 3. Get System Users Collection
        const sysUsersRes = await fetch(`${pbUrl}/api/collections/users`, { headers });
        const sysUsersCol = await sysUsersRes.json();
        console.log(`System Users Collection (users) ID: ${sysUsersCol.id}`);

        if (userField.options.collectionId === usuariosCol.id) {
            console.log('SUCCESS: User field points to Custom Users collection.');
        } else if (userField.options.collectionId === sysUsersCol.id) {
            console.log('WARNING: User field points to System Users collection.');
        } else {
            console.log('ERROR: User field points to unknown collection:', userField.options.collectionId);
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

debug();

