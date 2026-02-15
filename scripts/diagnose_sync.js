
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// Autenticação (substitua com credenciais válidas se necessário, ou use admin)
// Assumindo que posso rodar como admin localmente ou script JS
// Mas este script roda com node, preciso de credenciais.
// Vou usar o email/senha do admin se tiver, ou tentar listar sem auth se for public (provavelmente não).
// Vou tentar login como admin.
const adminEmail = 'admin@admin.com'; // Chute comum, ou preciso pedir ao user.
// Melhor: criar um script .js na pasta pb_hooks que roda ao iniciar ou via rota temporária, 
// pois lá tenho acesso ao $app.dao().

// Mas pb_hooks requer restart.
// Vou criar um script nodejs e tentar usar as credenciais que o user usou antes? 
// Não tenho acesso.
// Vou criar um arquivo na pasta scripts que o user pode rodar com "node scripts/..." mas ele precisa de credenciais.

// Melhor abordagem: Criar um hook temporário que expõe uma rota de debug pública (ou protegida mas fácil de chamar)
// Já tenho o `notifications.pb.js`. Vou adicionar uma rota GET /api/debug_notif_sync
// que aceita um event_title e retorna as notificações.

// Mas para não pedir restart de novo, vou tentar usar o `CreateEvent.tsx` que o user já tem aberto? Não.

// Vou usar o `scripts/check_pb.js` como base, ele costuma ter login.
// O `check_pb.js` existente no file list usa 'admin@email.com' / '1234567890'.
// Vou tentar essas credenciais.

async function main() {
    try {
        await pb.admins.authWithPassword('admin@email.com', '1234567890');
        console.log('Logged in as admin');

        // Buscar evento pelo título (aproximado)
        const eventTitle = 'gsdfg'; 
        const events = await pb.collection('agenda_cap53_eventos').getFullList({
            filter: `title ~ "${eventTitle}"`
        });

        if (events.length === 0) {
            console.log('Evento não encontrado com título:', eventTitle);
            return;
        }

        const event = events[0];
        console.log('Evento encontrado:', event.id, event.title);

        // Buscar notificações
        const notifications = await pb.collection('agenda_cap53_notifications').getFullList({
            filter: `event = "${event.id}"`
        });

        console.log(`Encontradas ${notifications.length} notificações para o evento.`);
        
        notifications.forEach(n => {
            console.log('------------------------------------------------');
            console.log('ID:', n.id);
            console.log('Message:', n.message);
            console.log('Type:', n.type);
            console.log('Related Request:', n.related_request);
            console.log('Data:', JSON.stringify(n.data, null, 2));
        });

        // Buscar Requests
        const requests = await pb.collection('agenda_cap53_almac_requests').getFullList({
            filter: `event = "${event.id}"`
        });
        console.log('------------------------------------------------');
        console.log(`Encontrados ${requests.length} pedidos para o evento.`);
        requests.forEach(r => {
            console.log('Req ID:', r.id);
            console.log('Item:', r.item);
            console.log('Qty:', r.quantity);
            console.log('Status:', r.status);
        });

    } catch (e) {
        console.error('Erro:', e);
    }
}

main();
