import PocketBase from 'pocketbase';
const pb = new PocketBase('https://centraldedados.duckdns.org');

async function check() {
    try {
        console.log('Checking debtflow_usuarios type...');
        const coll = await pb.collections.getOne('debtflow_usuarios');
        console.log('Type:', coll.type);
        console.log('Schema:', JSON.stringify(coll.schema, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

check();
