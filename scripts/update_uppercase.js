const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://centraldedados.dev.br');

async function updateRecords() {
    try {
        await pb.admins.authWithPassword('fabio.fdo@hotmail.com', 'Ffdo#11235813!');
        console.log('Autenticado como admin.');

        // 1. Usuarios
        console.log('Atualizando usuários...');
        const users = await pb.collection('agenda_cap53_usuarios').getFullList();
        for (const user of users) {
            if (user.name) {
                const newName = user.name.trim().toUpperCase();
                if (user.name !== newName) {
                    await pb.collection('agenda_cap53_usuarios').update(user.id, { name: newName });
                    console.log(`Usuário atualizado: ${user.name} -> ${newName}`);
                }
            }
        }

        // 2. Locais
        console.log('Atualizando locais...');
        const locais = await pb.collection('agenda_cap53_locais').getFullList();
        for (const loc of locais) {
            if (loc.name) {
                const newName = loc.name.trim().toUpperCase();
                if (loc.name !== newName) {
                    await pb.collection('agenda_cap53_locais').update(loc.id, { name: newName });
                    console.log(`Local atualizado: ${loc.name} -> ${newName}`);
                }
            }
        }

        // 3. Tipos de Evento
        console.log('Atualizando tipos de evento...');
        const tipos = await pb.collection('agenda_cap53_tipos_evento').getFullList();
        for (const tipo of tipos) {
            if (tipo.name) {
                const newName = tipo.name.trim().toUpperCase();
                if (tipo.name !== newName) {
                    await pb.collection('agenda_cap53_tipos_evento').update(tipo.id, { name: newName });
                    console.log(`Tipo de evento atualizado: ${tipo.name} -> ${newName}`);
                }
            }
        }

        // 4. Eventos (custom_location e title para uppercase tambem? O usuario so pediu para locais personalizados e nomes de usuarios)
        console.log('Atualizando eventos (custom_location)...');
        const eventos = await pb.collection('agenda_cap53_eventos').getFullList();
        for (const ev of eventos) {
            if (ev.custom_location) {
                const newLoc = ev.custom_location.trim().toUpperCase();
                if (ev.custom_location !== newLoc) {
                    await pb.collection('agenda_cap53_eventos').update(ev.id, { custom_location: newLoc });
                    console.log(`Evento custom_location atualizado: ${ev.custom_location} -> ${newLoc}`);
                }
            }
        }

        console.log('Tudo finalizado com sucesso!');
    } catch (err) {
        console.error('Erro:', err);
    }
}

updateRecords();
