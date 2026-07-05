
const pbUrl = 'https://centraldedados.dev.br';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';

async function checkAndFix() {
    try {
        // Auth
        let token;
        const adminRes = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });
        if (adminRes.ok) {
            token = (await adminRes.json()).token;
        } else {
            const suRes = await fetch(`${pbUrl}/api/superusers/auth-with-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: adminEmail, password: adminPass })
            });
            if (!suRes.ok) throw new Error('Auth failed');
            token = (await suRes.json()).token;
        }

        const headers = { 'Content-Type': 'application/json', 'Authorization': token };

        // Verificar schema da collection
        console.log('Buscando schema de agenda_cap53_usuarios...');
        const colRes = await fetch(`${pbUrl}/api/collections/agenda_cap53_usuarios`, { headers });
        if (!colRes.ok) throw new Error(`Collection not found: ${colRes.status}`);
        const collection = await colRes.json();

        const calendarField = collection.schema?.find(f => f.name === 'calendar_filters');

        if (calendarField) {
            console.log('Campo calendar_filters JÁ EXISTE!');
            console.log('Tipo:', calendarField.type);
            console.log('Options:', JSON.stringify(calendarField.options || {}));
        } else {
            console.log('Campo calendar_filters NÃO EXISTE. Criando...');

            const newSchema = [
                ...collection.schema,
                {
                    name: 'calendar_filters',
                    type: 'json',
                    required: false,
                    options: {}
                }
            ];

            const updateRes = await fetch(`${pbUrl}/api/collections/agenda_cap53_usuarios`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ schema: newSchema })
            });

            if (updateRes.ok) {
                console.log('Campo calendar_filters criado com sucesso!');
            } else {
                const err = await updateRes.json();
                console.error('Erro ao criar campo:', JSON.stringify(err, null, 2));
            }
        }

        // Verificar um usuário para testar
        console.log('\nVerificando dados de um usuário...');
        const usersRes = await fetch(`${pbUrl}/api/collections/agenda_cap53_usuarios/records?page=1&perPage=3`, { headers });
        if (usersRes.ok) {
            const users = await usersRes.json();
            users.items?.forEach(u => {
                console.log(`  ${u.name || u.email}: calendar_filters =`, JSON.stringify(u.calendar_filters || 'NÃO DEFINIDO'));
            });
        }

    } catch (err) {
        console.error('Erro:', err.message);
    }
}

checkAndFix();
