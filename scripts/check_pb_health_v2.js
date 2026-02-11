
import PocketBase from 'pocketbase';

async function listCollections() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');

    try {
        console.log('Fetching collections...');
        const colNames = [
            'agenda_cap53_usuarios',
            'agenda_cap53_locais',
            'agenda_cap53_itens_servico',
            'agenda_cap53_eventos',
            'agenda_cap53_notificacoes',
            'agenda_cap53_notifications'
        ];

        for (const fullName of colNames) {
            try {
                const res = await fetch(`https://centraldedados.duckdns.org/api/collections/${fullName}/records?perPage=1`);
                console.log(`- ${fullName}: ${res.status} ${res.statusText}`);
                if (res.status === 200) {
                    const data = await res.json();
                    console.log(`  Count: ${data.totalItems}`);
                }
            } catch (e) {
                console.log(`- ${fullName}: Error ${e.message}`);
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

listCollections();
