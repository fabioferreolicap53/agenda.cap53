
const PB_URL = 'https://centraldedados.duckdns.org';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

async function setupDCA_V2() {
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

        // 1. Update agenda_cap53_usuarios role options
        console.log('Checking agenda_cap53_usuarios schema...');
        const userCollRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_usuarios`, {
            headers: { 'Authorization': token }
        });

        if (userCollRes.ok) {
            const collection = await userCollRes.json();
            const roleField = collection.schema.find(f => f.name === 'role');
            
            if (roleField && roleField.type === 'select') {
                if (!roleField.options.values.includes('DCA')) {
                    console.log('Adding DCA to role options...');
                    roleField.options.values.push('DCA');
                    
                    const updateRes = await fetch(`${PB_URL}/api/collections/agenda_cap53_usuarios`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token
                        },
                        body: JSON.stringify({ schema: collection.schema })
                    });
                    
                    if (updateRes.ok) {
                        console.log('User role schema updated successfully!');
                    } else {
                        console.error('Failed to update user role schema:', await updateRes.text());
                    }
                } else {
                    console.log('DCA already in role options.');
                }
            }
        }

        // 2. Create DCA User (Retry after schema update)
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
            console.error('Failed to create DCA user:', await userRes.text());
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

setupDCA_V2();
