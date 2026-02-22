
import PocketBase from 'pocketbase';

async function listCollections() {
    const pb = new PocketBase('https://centraldedados.dev.br');

    try {
        console.log('Fetching collections...');
        // We can't use pb.collections.getFullList() without admin auth
        // But we can try to fetch records from known collections to see if they exist
        const knownPrefixes = ['agenda_cap53_', 'agenda_cap5_3_', 'agenda_cap53'];
        const collections = ['usuarios', 'locais', 'itens_servico', 'eventos'];

        for (const prefix of knownPrefixes) {
            for (const col of collections) {
                const fullName = prefix + col;
                try {
                    const res = await fetch(`https://centraldedados.dev.br/api/collections/${fullName}/records?perPage=1`);
                    console.log(`- ${fullName}: ${res.status} ${res.statusText}`);
                } catch (e) {
                    console.log(`- ${fullName}: Error ${e.message}`);
                }
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

listCollections();

