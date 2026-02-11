import PocketBase from 'pocketbase';

async function testFetch() {
    const pb = new PocketBase('https://centraldedados.duckdns.org');
    try {
        const events = await pb.collection('agenda_cap53_eventos').getList(1, 5, {
            sort: '-created'
        });
        console.log('--- RECENT EVENTS ---');
        events.items.forEach(e => {
            console.log(`Title: ${e.title}`);
            console.log(`Creator Role: ${e.creator_role}`);
            console.log(`User ID: ${e.user}`);
            console.log('---');
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testFetch();
