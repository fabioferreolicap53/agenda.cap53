
const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function setupDCA() {
    try {
        console.log('Authenticating admin...');
        const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
        });

        if (!authRes.ok) {
            const err = await authRes.text();
            throw new Error(`Admin auth failed: ${err}`);
        }

        const { token } = await authRes.json();
        console.log('Authenticated!');

        // 1. Create DCA User
        console.log('Creating DCA user...');
        const userRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_usuarios/records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({
                email: 'dca@cap53.com',
                password: 'password123',
                passwordConfirm: 'password123',
                name: 'DCA Informática',
                role: 'DCA',
                status: 'Online',
                verified: true
            })
        });

        if (userRes.ok) {
            console.log('DCA user created successfully!');
        } else {
            const err = await userRes.text();
            if (err.includes('validation_invalid_email')) {
                console.log('DCA user might already exist.');
            } else {
                console.error('Failed to create DCA user:', err);
            }
        }

        // 2. Update agenda_cap53_itens_servico category options if it's a select field
        console.log('Checking agenda_cap53_itens_servico schema...');
        const collRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico`, {
            headers: { 'Authorization': token }
        });

        if (collRes.ok) {
            const collection = await collRes.json();
            const categoryField = collection.schema.find(f => f.name === 'category');
            
            if (categoryField && categoryField.type === 'select') {
                if (!categoryField.options.values.includes('INFORMATICA')) {
                    console.log('Adding INFORMATICA to category options...');
                    categoryField.options.values.push('INFORMATICA');
                    
                    const updateRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token
                        },
                        body: JSON.stringify({ schema: collection.schema })
                    });
                    
                    if (updateRes.ok) {
                        console.log('Collection schema updated successfully!');
                    } else {
                        console.error('Failed to update schema:', await updateRes.text());
                    }
                } else {
                    console.log('INFORMATICA already in options.');
                }
            }
        }

        // 3. Update API Rules to allow DCA
        console.log('Updating API Rules for agenda_cap53_itens_servico...');
        const dcaRule = '@request.auth.role = "ADMIN" || @request.auth.role = "ALMC" || @request.auth.role = "DCA"';
        const ruleUpdateRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_itens_servico`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({
                createRule: dcaRule,
                updateRule: dcaRule,
                deleteRule: dcaRule
            })
        });

        if (ruleUpdateRes.ok) {
            console.log('API Rules updated for DCA!');
        } else {
            console.error('Failed to update API Rules:', await ruleUpdateRes.text());
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

setupDCA();
