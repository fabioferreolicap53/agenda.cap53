import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env manualmente (sem dotenv)
const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^#=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
});

const pbUrl = env.VITE_POCKETBASE_URL || 'https://centraldedados.dev.br';
const adminEmail = env.VITE_DB_LOGIN;
const adminPass = env.VITE_DB_PASSWORD;

if (!adminEmail || !adminPass) {
    console.error('Credenciais não encontradas no .env (VITE_DB_LOGIN / VITE_DB_PASSWORD)');
    process.exit(1);
}

async function fixSettings() {
    console.log('--- Fixing PocketBase Mail Settings ---');

    try {
        // 1. Authenticate
        const authResponse = await fetch(`${pbUrl}/api/collections/_superusers/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });

        if (!authResponse.ok) {
            throw new Error(`Admin auth failed: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const token = authData.token;

        const frontendUrl = 'https://agenda-cap53.pages.dev';

        // 2. Atualizar settings gerais + templates customizados
        const updateBody = {
            meta: {
                appUrl: frontendUrl,
                verificationTemplate: {
                    actionUrl: `${frontendUrl}/verify-email?verify={TOKEN}`
                },
                resetPasswordTemplate: {
                    actionUrl: `${frontendUrl}/reset-password?token={TOKEN}`
                },
                emailChangeTemplate: {
                    actionUrl: `${frontendUrl}/confirm-email-change?token={TOKEN}`
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
            const errorBody = await updateResponse.text();
            throw new Error(`Failed to update settings: ${updateResponse.status} - ${errorBody}`);
        }

        const newSettings = await updateResponse.json();
        console.log('Settings Updated Successfully!');
        console.log('App URL:', newSettings.meta?.appUrl);
        console.log('Verification URL:', newSettings.meta?.verificationTemplate?.actionUrl);
        console.log('Reset Password URL:', newSettings.meta?.resetPasswordTemplate?.actionUrl);
        console.log('Email Change URL:', newSettings.meta?.emailChangeTemplate?.actionUrl);

    } catch (error) {
        console.error('Error:', error);
    }
}

fixSettings();
