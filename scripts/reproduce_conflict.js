
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

(async () => {
    try {
        // Authenticate
        const authData = await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
        console.log('Authenticated');

        const date_start = "2026-02-10 10:00:00.000Z";
        const date_end = "2026-02-10 11:00:00.000Z";
        const unit = "CF ALICE DE JESUS REGO";
        const category = "MÃ‰DICO(A)";

        console.log('1. Creating a base event...');
        const baseEvent = await pb.collection('agenda_cap53_eventos').create({
            title: 'Test Conflict Base',
            date_start,
            date_end,
            unidades: [unit],
            categorias_profissionais: [category],
            status: 'active',
            user: '68ay1cuzk4kk8tw' 
        });
        console.log('Base event created:', baseEvent.id);

        // Try to find it using the filter from CreateEvent.tsx
        const startFilter = date_start;
        const endFilter = date_end;
        const categoryFilter = `(categorias_profissionais ?= "${category}") && (unidades ?= "${unit}") && status != "canceled" && date_start < "${endFilter}" && date_end > "${startFilter}"`;

        console.log('2. Searching for conflicts with filter:', categoryFilter);
        const conflicts = await pb.collection('agenda_cap53_eventos').getList(1, 1, {
            filter: categoryFilter
        });

        console.log('Conflicts found:', conflicts.totalItems);
        if (conflicts.totalItems > 0) {
            console.log('Success: Conflict detected!');
        } else {
            console.log('Failure: Conflict NOT detected!');
        }

        // Cleanup
        await pb.collection('agenda_cap53_eventos').delete(baseEvent.id);
        console.log('Cleanup done.');

    } catch (e) {
        console.error('Error:', e.message);
        if (e.data) console.error('Data:', JSON.stringify(e.data));
    }
})();

