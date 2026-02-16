
import { strict as assert } from 'assert';

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@admin.com';
const ADMIN_PASS = process.env.PB_ADMIN_PASS || '1234567890';

console.log(`🌍 Target: ${PB_URL}`);
console.log(`👤 Admin: ${ADMIN_EMAIL}`);

async function authenticate(email, password) {
    const res = await fetch(`${PB_URL}/api/collections/users/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
    return data.token;
}

async function authAsAdmin() {
    const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Admin Auth failed: ${JSON.stringify(data)}`);
    return data.token;
}

async function createRecord(collection, data, token) {
    const res = await fetch(`${PB_URL}/api/collections/${collection}/records`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token 
        },
        body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Create ${collection} failed: ${JSON.stringify(json)}`);
    return json;
}

async function updateRecord(collection, id, data, token) {
    const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token 
        },
        body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Update ${collection} failed: ${JSON.stringify(json)}`);
    return json;
}

async function getNotifications(userId, token) {
    const res = await fetch(`${PB_URL}/api/collections/agenda_cap53_notifications/records?filter=(user='${userId}')&sort=-created`, {
        headers: { 'Authorization': token }
    });
    const json = await res.json();
    return json.items;
}

async function deleteRecord(collection, id, token) {
    await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
    });
}

async function run() {
    console.log('🚀 Starting Full Flow Verification...');
    
    try {
        const adminToken = await authAsAdmin();
        console.log('✅ Admin authenticated');

        // 1. Setup Users
        const timestamp = Date.now();
        const creatorEmail = `creator_${timestamp}@test.com`;
        const almcEmail = `almc_${timestamp}@test.com`;
        
        console.log('👤 Creating users...');
        const creator = await createRecord('agenda_cap53_usuarios', {
            username: `creator_${timestamp}`,
            email: creatorEmail,
            emailVisibility: true,
            password: '12345678',
            passwordConfirm: '12345678',
            name: 'Creator User',
            role: 'user'
        }, adminToken);
        
        const almcUser = await createRecord('agenda_cap53_usuarios', {
            username: `almc_${timestamp}`,
            email: almcEmail,
            emailVisibility: true,
            password: '12345678',
            passwordConfirm: '12345678',
            name: 'ALMC User',
            role: 'ALMC'
        }, adminToken);

        // Authenticate as users to get their tokens
        // const creatorToken = await authenticate(creatorEmail, '12345678'); // Not strictly needed for this test if admin does actions
        
        // 2. Create Item (Cadeira)
        console.log('🪑 Creating item...');
        const item = await createRecord('agenda_cap53_itens_servico', {
            name: `Cadeira Teste ${timestamp}`,
            category: 'ALMOXARIFADO',
            active: true
        }, adminToken);

        // 3. Create Event
        console.log('📅 Creating event...');
        const event = await createRecord('agenda_cap53_eventos', {
            title: `Evento Teste ${timestamp}`,
            date_start: new Date().toISOString(),
            date_end: new Date(Date.now() + 3600000).toISOString(),
            user: creator.id,
            status: 'approved' // Auto-approve to simplify
        }, adminToken);

        // 4. Create Request (Creator requests Cadeira)
        console.log('📝 Creating request...');
        const request = await createRecord('agenda_cap53_almac_requests', {
            event: event.id,
            item: item.id,
            quantity: 5,
            status: 'pending',
            created_by: creator.id
        }, adminToken);

        console.log('⏳ Waiting for hooks (2s)...');
        await new Promise(r => setTimeout(r, 2000));

        // 5. Verify Notification for ALMC
        console.log('🔍 Checking ALMC notifications...');
        const almcNotifs = await getNotifications(almcUser.id, adminToken);
        const requestNotif = almcNotifs.find(n => n.related_request === request.id && n.type === 'new_request');
        
        if (requestNotif) {
            console.log('✅ ALMC Notification received:', requestNotif.id);
        } else {
            console.error('❌ ALMC Notification NOT received!');
            console.log('All ALMC Notifs:', almcNotifs);
        }

        // 6. Approve Request (ALMC Action)
        console.log('✅ Approving request...');
        await updateRecord('agenda_cap53_almac_requests', request.id, {
            status: 'approved'
        }, adminToken);

        console.log('⏳ Waiting for hooks (2s)...');
        await new Promise(r => setTimeout(r, 2000));

        // 7. Verify Notification for Creator
        console.log('🔍 Checking Creator notifications...');
        const creatorNotifs = await getNotifications(creator.id, adminToken);
        const decisionNotif = creatorNotifs.find(n => n.related_request === request.id && n.type === 'request_decision');

        if (decisionNotif) {
            console.log('✅ Creator Notification received:', decisionNotif.id);
            console.log('   Title:', decisionNotif.title);
            console.log('   Message:', decisionNotif.message);
        } else {
            console.error('❌ Creator Notification NOT received!');
            console.log('All Creator Notifs:', creatorNotifs);
        }

        // Cleanup
        console.log('🧹 Cleaning up...');
        try {
            await deleteRecord('agenda_cap53_almac_requests', request.id, adminToken);
            await deleteRecord('agenda_cap53_eventos', event.id, adminToken);
            await deleteRecord('agenda_cap53_itens_servico', item.id, adminToken);
            await deleteRecord('agenda_cap53_usuarios', creator.id, adminToken);
            await deleteRecord('agenda_cap53_usuarios', almcUser.id, adminToken);
        } catch (e) {
            console.error('Cleanup error:', e.message);
        }

    } catch (err) {
        console.error('❌ Script failed:', err);
    }
}

run();
