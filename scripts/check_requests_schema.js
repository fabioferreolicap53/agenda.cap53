
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

(async () => {
    try {
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
        
        const cols = ['agenda_cap53_almac_requests', 'agenda_cap53_solicitacoes_evento'];
        
        for (const c of cols) {
            const col = await pb.collections.getOne(c);
            console.log(`\n--- Schema for ${c} ---`);
            col.schema.forEach(f => {
                console.log(`${f.name} (${f.type})`);
            });
        }
    } catch (e) {
        console.error(e);
    }
})();
