
const pbUrl = 'https://centraldedados.dev.br';
const adminEmail = 'fabioferreoli@gmail.com';
const adminPass = '@Cap5364125';

async function fixSettings() {
    console.log('--- Fixing PocketBase Mail Settings ---');

    try {
        // 1. Authenticate
        const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });
        
        if (!authResponse.ok) {
            throw new Error(`Admin auth failed: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const token = authData.token;

        // 2. Update Settings
        // We want to change appUrl to the frontend URL
        // And ensure actionUrl points to the hash router
        const frontendUrl = 'https://agenda-cap53.pages.dev';

        const updateBody = {
            meta: {
                appUrl: frontendUrl,
                verificationTemplate: {
                    actionUrl: "{APP_URL}/#/verify-email/{TOKEN}"
                },
                resetPasswordTemplate: {
                    actionUrl: "{APP_URL}/#/reset-password/{TOKEN}"
                }
            }
        };

        const updateResponse = await fetch(`${pbUrl}/api/settings`, {
            method: 'PATCH',
            headers: { 
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateBody)
        });

        if (!updateResponse.ok) {
            throw new Error(`Failed to update settings: ${updateResponse.status}`);
        }

        const newSettings = await updateResponse.json();
        console.log('✅ Settings Updated Successfully!');
        console.log('New App URL:', newSettings.meta.appUrl);
        console.log('New Verification URL:', newSettings.meta.verificationTemplate.actionUrl);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixSettings();
