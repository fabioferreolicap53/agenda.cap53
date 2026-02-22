
const PocketBase = require('pocketbase/cjs');

async function checkUsers() {
  const pb = new PocketBase('https://centraldedados.dev.br');
  try {
    const users = await pb.collection('agenda_cap53_usuarios').getList(1, 5);
    console.log(`Users found: ${users.totalItems}`);
  } catch (err) {
    console.log('Users collection not accessible or empty');
  }
}
checkUsers();

