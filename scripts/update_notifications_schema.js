
import PocketBase from 'pocketbase';

// Using raw fetch to avoid SDK version mismatches with the server
const BASE_URL = 'https://centraldedados.duckdns.org';

async function updateSchema() {
    try {
        console.log('Authenticating as Admin...');
        const loginRes = await fetch(`${BASE_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: 'fabioferreoli@gmail.com', password: '@Cap5364125' })
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${await loginRes.text()}`);
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Authenticated.');

        // Get Notification Collection
        console.log('Fetching agenda_cap53_notifications...');
        const colRes = await fetch(`${BASE_URL}/api/collections/agenda_cap53_notifications`, {
            headers: { 'Authorization': token }
        });

        if (!colRes.ok) throw new Error(`Failed to fetch collection: ${await colRes.text()}`);
        
        const collection = await colRes.json();
        console.log(`Found collection: ${collection.name} (${collection.id})`);

        // Get Almac Collection ID for relation
        console.log('Fetching agenda_cap53_almac_requests...');
        const almacRes = await fetch(`${BASE_URL}/api/collections/agenda_cap53_almac_requests`, {
             headers: { 'Authorization': token }
        });
        if (!almacRes.ok) throw new Error('Failed to fetch almac requests collection');
        const almacCol = await almacRes.json();


        const hasData = collection.schema.find(f => f.name === 'data');
        const hasAcknowledged = collection.schema.find(f => f.name === 'acknowledged');
        const hasRelatedRequest = collection.schema.find(f => f.name === 'related_request');

        if (hasData && hasAcknowledged && hasRelatedRequest) {
            console.log('Schema already up to date.');
            return;
        }

        const newSchema = [...collection.schema];

        if (!hasData) {
            console.log('Adding "data" field...');
            newSchema.push({
                system: false,
                name: 'data',
                type: 'json',
                required: false,
                unique: false,
                options: { maxSize: 2000000 }
            });
        }

        if (!hasAcknowledged) {
            console.log('Adding "acknowledged" field...');
            newSchema.push({
                system: false,
                name: 'acknowledged',
                type: 'bool',
                required: false,
                unique: false,
                options: {}
            });
        }

        if (!hasRelatedRequest) {
            console.log('Adding "related_request" field...');
            newSchema.push({
                system: false,
                name: 'related_request',
                type: 'relation',
                required: false,
                unique: false,
                options: {
                    collectionId: almacCol.id,
                    cascadeDelete: false,
                    minSelect: null,
                    maxSelect: 1,
                    displayFields: null
                }
            });
        }

        // Update collection
        console.log('Updating collection schema...');
        // We need to send the whole collection object structure, but typically just schema changes are enough if we use patch/update correctly
        // But for PB, we usually send the whole object or at least the schema
        
        // Construct update payload
        const payload = {
            schema: newSchema
        };

        const updateRes = await fetch(`${BASE_URL}/api/collections/${collection.id}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!updateRes.ok) {
            throw new Error(`Failed to update schema: ${await updateRes.text()}`);
        }

        console.log('Schema updated successfully!');

    } catch (err) {
        console.error('Error updating schema:', err);
    }
}

updateSchema();
