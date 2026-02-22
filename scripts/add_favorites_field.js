
const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090'; // Default to local if not set, but user likely has it set or I can use the one from other scripts
const adminEmail = process.env.PB_ADMIN_EMAIL;
const adminPass = process.env.PB_ADMIN_PASS;

// Remove trailing slash if present
let normalizedPbUrl = pbUrl;
if (normalizedPbUrl.endsWith('/')) {
    normalizedPbUrl = normalizedPbUrl.slice(0, -1);
}

if (!adminEmail || !adminPass) {
    console.error('Error: PB_ADMIN_EMAIL and PB_ADMIN_PASS environment variables are required.');
    console.error('Example: set PB_ADMIN_EMAIL=admin@example.com && set PB_ADMIN_PASS=1234567890 && node scripts/add_favorites_field.js');
    process.exit(1);
}

async function addFavoritesField() {
    console.log('--- Adding favorites field to agenda_cap53_usuarios ---');
    console.log(`Target URL: ${normalizedPbUrl}`);

    try {
        // 1. Authenticate
        const authUrl = `${normalizedPbUrl}/api/admins/auth-with-password`;
        console.log(`Authenticating at: ${authUrl}`);
        
        const authResponse = await fetch(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: adminEmail, password: adminPass })
        });

        if (!authResponse.ok) {
            throw new Error(`Auth failed: ${authResponse.status} ${authResponse.statusText}`);
        }

        const token = (await authResponse.json()).token;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token
        };

        // 2. Get the collection to find its ID and current schema
        const collectionName = 'agenda_cap53_usuarios';
        const getRes = await fetch(`${normalizedPbUrl}/api/collections/${collectionName}`, { headers });
        
        if (!getRes.ok) {
            throw new Error(`Failed to fetch collection ${collectionName}: ${getRes.status}`);
        }

        const collection = await getRes.json();
        const collectionId = collection.id;
        
        // 3. Check if field exists
        const schema = collection.schema || [];
        const exists = schema.find(f => f.name === 'favorites');

        if (exists) {
            console.log('Field "favorites" already exists. No changes needed.');
            return;
        }

        // 4. Add the field
        // We use the collection's own ID because it's a self-relation (users favorite users)
        const newField = {
            system: false,
            id: '', // New field
            name: 'favorites',
            type: 'relation',
            required: false,
            presentable: false,
            unique: false,
            options: {
                collectionId: collectionId,
                cascadeDelete: false,
                minSelect: null,
                maxSelect: null, // Unlimited
                displayFields: []
            }
        };

        schema.push(newField);

        // 5. Update the collection
        const updateRes = await fetch(`${normalizedPbUrl}/api/collections/${collectionName}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ schema })
        });

        if (!updateRes.ok) {
            const err = await updateRes.json();
            throw new Error(`Failed to update collection: ${JSON.stringify(err, null, 2)}`);
        }

        console.log('Success! Field "favorites" added to agenda_cap53_usuarios.');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

addFavoritesField();
