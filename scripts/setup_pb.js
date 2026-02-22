import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASS = '@Cap5364125';

const pb = new PocketBase(PB_URL);

// --- Helpers ---
function logSuccess(msg) {
    console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`);
}

function logError(msg) {
    console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`);
}

function logInfo(msg) {
    console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`);
}

async function authenticate() {
    logInfo(`Connecting to ${PB_URL}...`);

    // Attempt 1: SDK Standard (likely matches installed version's default)
    try {
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
        logSuccess('Authenticated via SDK.');
        return;
    } catch (e) {
        logInfo(`SDK Auth failed (${e.message}), trying raw REST fallback...`);
    }

    // Fallback: Try Raw Endpoints
    const endpoints = [
        '/api/superusers/auth-with-password', // PB 0.23+
        '/api/admins/auth-with-password'      // PB < 0.23
    ];

    for (const endpoint of endpoints) {
        try {
            logInfo(`Trying endpoint: ${endpoint}`);
            const response = await fetch(`${PB_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
            });

            if (!response.ok) {
                if (response.status === 404) continue; // Try next
                const text = await response.text();
                throw new Error(`${response.status} ${text}`);
            }

            const data = await response.json();
            // data.token and data.admin (or data.superuser)
            pb.authStore.save(data.token, data.admin || data.superuser);
            logSuccess(`Authenticated via REST (${endpoint})`);
            return;
        } catch (err) {
            logInfo(`Failed ${endpoint}: ${err.message}`);
        }
    }

    logError('All authentication methods failed.');
    process.exit(1);
}

async function updateCollection(collectionNameOrId, data) {
    try {
        const collection = await pb.collections.getOne(collectionNameOrId);
        await pb.collections.update(collection.id, data);
        logSuccess(`Updated collection "${collection.name}"`);
        return collection;
    } catch (error) {
        if (error.status === 404) {
            // Collection might not exist, handled by separate create logic if needed
            // For users, it usually exists.
            throw error;
        }
        logError(`Failed to update collection ${collectionNameOrId}: ${error.message}`);
    }
}

async function createOrUpdateCollection(name, schema, rules = {}) {
    logInfo(`Processing collection: ${name}`);

    // Check if collection exists
    let collection;
    try {
        collection = await pb.collections.getOne(name);
        logInfo(`Collection "${name}" exists. Updating...`);
    } catch (e) {
        if (e.status !== 404) throw e;
        logInfo(`Collection "${name}" does not exist. Creating...`);
    }

    // Construct payload
    // Note: For 'update', we should merge with existing schema to avoid data loss if we were partial?
    // But protocol says: "PATCH enviando o objeto completo"
    // So we will just define the fields we want. 
    // Ideally we append new fields to existing ones if we don't want to break things, 
    // but here we are defining the schema authoritative.

    // Actually, to be safe against deleting fields not in our list, let's fetch existing fields if update.
    let finalFields = schema;
    if (collection) {
        // We generally append or update.
        // For this script, we assume we want to ENFORCE the schema provided.
        // But let's check if fields exist physically as per protocol.

        // Protocol: "Verifique se os campos necessÃ¡rios existem fisicamente... realiz um PATCH enviando o objeto completo"

        // Let's create a map of existing fields
        const existingFieldsCheck = collection.fields || []; // PB 0.23+ might differ in structure?
        // In recent PB, 'fields' is an array of objects in the collection config.

        // We will concat our new fields if they don't exist by name
        // But simpler: just pass the schema list. PB SDK handles merging typically? 
        // No, pb.collections.update replaces the schema/fields definition. 
        // We must include old fields if we want to keep them.

        const existingFieldNames = new Set(collection.schema.map(f => f.name));
        const newFields = schema.filter(f => !existingFieldNames.has(f.name));

        if (newFields.length === 0 && collection.schema.length >= schema.length) {
            logInfo(`No new fields to add for ${name}.`);
            // We might still need to update rules or types matches
        }

        // Strategy: We will read existing schema, and add/update our fields.
        let mergedSchema = [...collection.schema];

        schema.forEach(newField => {
            const idx = mergedSchema.findIndex(f => f.name === newField.name);
            if (idx >= 0) {
                // Update existing field definition
                mergedSchema[idx] = { ...mergedSchema[idx], ...newField };
            } else {
                mergedSchema.push(newField);
            }
        });

        finalFields = mergedSchema;
    }

    const data = {
        name: name,
        type: 'base',
        schema: finalFields,
        ...rules
    };

    try {
        if (collection) {
            await pb.collections.update(collection.id, data);
            logSuccess(`Collection "${name}" updated.`);
        } else {
            await pb.collections.create(data);
            logSuccess(`Collection "${name}" created.`);
        }
    } catch (error) {
        logError(`Failed to save collection ${name}: ${error.data?.message || error.message}`);
        console.dir(error.data, { depth: null });
    }
}

async function configureUsersCollection() {
    logInfo('Configuring "debtflow_usuarios" collection...');

    // The default users collection is usually named 'users'. 
    // User requested "debtflow_usuarios (ou similar)". 
    // We will stick to the default 'users' system collection but configure it.

    try {
        const users = await pb.collections.getOne('debtflow_usuarios');

        // Define additional fields
        const desiredFields = [
            { name: 'name', type: 'text' },
            { name: 'avatar', type: 'file', maxSelect: 1 },
            { name: 'role', type: 'select', maxSelect: 1, values: ['USER', 'ADMIN', 'ALMC', 'TRA', 'CE'] },
            { name: 'status', type: 'select', maxSelect: 1, values: ['online', 'away', 'busy', 'offline'] },
            { name: 'phone', type: 'text' },
            { name: 'sector', type: 'text' },
            { name: 'observations', type: 'text' }
        ];

        // Merge with existing schema
        let newSchema = [...users.schema];
        desiredFields.forEach(field => {
            if (!newSchema.find(f => f.name === field.name)) {
                newSchema.push(field);
            }
        });

        const updates = {
            schema: newSchema,
            // Auth options are top-level in recent PB, or inside 'options'?
            // Checking PB JS SDK / API... 
            // In modern PB, auth options are in the collection object directly usually? 
            // Actually, for 'auth' type collections, there are specific fields.

            // "Force allowEmailAuth: true and requireEmail: true"
            // "minPasswordLength: 8"

            // Note: SDK structure can verify. usually:
            // options: { allowEmailAuth: true, ... }
            options: {
                ...users.options,
                allowEmailAuth: true,
                allowOAuth2Auth: true,
                allowUsernameAuth: false, // Strict email
                allowEmailPasswordReset: true,
                requireEmail: true,
                minPasswordLength: 8
            },

            // "createRule: "" (public) and all other id = @request.auth.id"
            createRule: "",
            listRule: "@request.auth.id != ''", // Allow listing if authenticated (needed for participant selection)
            viewRule: "id = @request.auth.id || @request.auth.role = 'ADMIN'",
            updateRule: "id = @request.auth.id || @request.auth.role = 'ADMIN'",
            deleteRule: "id = @request.auth.id || @request.auth.role = 'ADMIN'",
        };

        await pb.collections.update(users.id, updates);
        logSuccess('Users collection (debtflow_usuarios) configured.');
    } catch (e) {
        logError('Error configuring users: ' + e.message);
    }
}

async function createAgendaEventos() {
    const name = 'agenda_eventos';

    // Resolve collection ID first
    let userColId = 'users';
    try {
        const userCol = await pb.collections.getOne('debtflow_usuarios');
        userColId = userCol.id;
    } catch (e) { logError("Could not find debtflow_usuarios, using 'users' fallback"); }

    let locaisColId = 'agenda_locais';
    try {
        const locaisCol = await pb.collections.getOne('agenda_locais');
        locaisColId = locaisCol.id;
    } catch (e) { logError("Could not find agenda_locais, using name fallback"); }

    const schema = [
        { name: 'title', type: 'text', required: true },
        {
            name: 'type',
            type: 'select',
            required: true,
            options: { maxSelect: 1, values: ['meeting', 'training', 'workshop'] }
        },
        {
            name: 'location',
            type: 'relation',
            required: true,
            options: {
                collectionId: locaisColId,
                maxSelect: 1,
                cascadeDelete: false
            }
        },
        { name: 'status', type: 'select', options: { maxSelect: 1, values: ['active', 'cancelled'] } },
        { name: 'cancel_reason', type: 'text' },
        { name: 'almoxarifado_items', type: 'json', options: { maxSize: 2000000 } },
        { name: 'copa_items', type: 'json', options: { maxSize: 2000000 } },
        { name: 'transporte_suporte', type: 'bool' },
        { name: 'date_start', type: 'date', required: true },
        { name: 'date_end', type: 'date', required: true },
        { name: 'unidades', type: 'json', options: { maxSize: 2000000 } },
        { name: 'categorias_profissionais', type: 'json', options: { maxSize: 2000000 } },
        { name: 'almoxarifado_confirmed_items', type: 'json', options: { maxSize: 2000000 } },
        { name: 'copa_confirmed_items', type: 'json', options: { maxSize: 2000000 } },
        { name: 'transporte_status', type: 'select', options: { maxSelect: 1, values: ['pending', 'confirmed', 'rejected'] } },
        {
            name: 'participants',
            type: 'relation',
            options: {
                collectionId: userColId,
                maxSelect: null,
                cascadeDelete: false
            }
        },
        {
            name: 'user',
            type: 'relation',
            options: {
                collectionId: userColId,
                maxSelect: 1,
                cascadeDelete: true
            }
        }
    ];

    const rules = {
        listRule: "user = @request.auth.id || participants.id ?>= @request.auth.id || @request.auth.role = 'ADMIN' || @request.auth.role = 'ALMC' || @request.auth.role = 'TRA' || @request.auth.role = 'CE'",
        viewRule: "user = @request.auth.id || participants.id ?>= @request.auth.id || @request.auth.role = 'ADMIN' || @request.auth.role = 'ALMC' || @request.auth.role = 'TRA' || @request.auth.role = 'CE'",
        createRule: "@request.auth.id != ''",
        updateRule: "user = @request.auth.id || @request.auth.role = 'ADMIN'",
        deleteRule: "user = @request.auth.id || @request.auth.role = 'ADMIN'",
    };

    await createOrUpdateCollection(name, schema, rules);
}

async function createAgendaLocais() {
    const name = 'agenda_locais';
    const schema = [
        { name: 'name', type: 'text', required: true, options: { unique: true } },
        { name: 'conflict_control', type: 'bool' },
        { name: 'is_available', type: 'bool' }
    ];
    const rules = {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'ADMIN' || @request.auth.role = 'CE'",
        updateRule: "@request.auth.role = 'ADMIN' || @request.auth.role = 'CE'",
        deleteRule: "@request.auth.role = 'ADMIN' || @request.auth.role = 'CE'",
    };
    await createOrUpdateCollection(name, schema, rules);
}

async function createAgendaItensServico() {
    const name = 'agenda_itens_servico';
    const schema = [
        { name: 'name', type: 'text', required: true },
        { name: 'type', type: 'select', required: true, options: { maxSelect: 1, values: ['almoxarifado', 'copa'] } },
        { name: 'is_available', type: 'bool' },
        { name: 'unit', type: 'text' }
    ];
    const rules = {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'ADMIN' || @request.auth.role = 'ALMC'",
        updateRule: "@request.auth.role = 'ADMIN' || @request.auth.role = 'ALMC'",
        deleteRule: "@request.auth.role = 'ADMIN' || @request.auth.role = 'ALMC'",
    };
    await createOrUpdateCollection(name, schema, rules);
}

async function createNotifications() {
    const name = 'notifications';

    let userColId = 'users';
    try {
        const userCol = await pb.collections.getOne('debtflow_usuarios');
        userColId = userCol.id;
    } catch (e) { logError("Could not find debtflow_usuarios for notifications"); }

    const schema = [
        { name: 'user', type: 'relation', required: true, options: { collectionId: userColId, maxSelect: 1, cascadeDelete: true } },
        { name: 'title', type: 'text', required: true },
        { name: 'message', type: 'text', required: true },
        { name: 'type', type: 'select', options: { maxSelect: 1, values: ['cancellation', 'service_request', 'info'] } },
        { name: 'read', type: 'bool' }
    ];
    const rules = {
        listRule: "user = @request.auth.id || @request.auth.role = 'ADMIN'",
        viewRule: "user = @request.auth.id || @request.auth.role = 'ADMIN'",
        createRule: "@request.auth.id != ''",
        updateRule: "user = @request.auth.id || @request.auth.role = 'ADMIN'",
        deleteRule: "user = @request.auth.id || @request.auth.role = 'ADMIN'",
    };
    await createOrUpdateCollection(name, schema, rules);
}

async function createAuditLogs() {
    const name = 'agenda_audit_logs';
    
    let userColId = 'users';
    try {
        const userCol = await pb.collections.getOne('debtflow_usuarios');
        userColId = userCol.id;
    } catch (e) { logError("Could not find debtflow_usuarios for audit logs"); }

    const schema = [
        { name: 'user', type: 'relation', required: true, options: { collectionId: userColId, maxSelect: 1, cascadeDelete: true } },
        { name: 'action', type: 'text', required: true },
        { name: 'target_type', type: 'text', required: true },
        { name: 'target_id', type: 'text' },
        { name: 'details', type: 'json' }
    ];
    const rules = {
        listRule: "@request.auth.role = 'ADMIN'",
        viewRule: "@request.auth.role = 'ADMIN'",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
    };
    await createOrUpdateCollection(name, schema, rules);
}

// --- Main ---
(async () => {
    console.log('--- Starting PocketBase Setup ---');
    await authenticate();

    // 1. Configure Users
    await configureUsersCollection();

    // 2. Create Agenda Locais
    await createAgendaLocais();

    // 3. Create Agenda Itens Servico
    await createAgendaItensServico();

    // 4. Create Notifications
    await createNotifications();

    // 4.1. Create Audit Logs
    await createAuditLogs();

    // 5. Create Agenda Events
    try {
        const events = await pb.collections.getOne('agenda_eventos');
        const locationField = events.schema.find(f => f.name === 'location');
        if (locationField && locationField.type === 'select') {
            logInfo('Renaming legacy "location" field to "location_old"...');
            const newSchema = events.schema.map(f => {
                if (f.name === 'location') return { ...f, name: 'location_old' };
                return f;
            });
            await pb.collections.update(events.id, { schema: newSchema });
        }
    } catch (e) {
        logInfo('Agenda Events does not exist or location field already updated.');
    }

    await createAgendaEventos();

    // 3. Report
    logInfo('--- Final Report ---');
    try {
        const collections = await pb.collections.getFullList();

        console.table(collections.map(c => ({
            Name: c.name,
            Type: c.type,
            ListRule: c.listRule,
            Fields: c.schema.map(f => f.name).join(', ')
        })));

        // Check SMTP
        const settings = await pb.settings.getAll();
        const smtpEnabled = settings.meta?.smtp?.enabled || settings.smtp?.enabled || "Unknown";
        logInfo(`SMTP Enabled: ${smtpEnabled} (Please verify in Admin UI if 'Unknown' or false)`);

    } catch (e) {
        logError('Failed to generate report: ' + e.message);
    }

})();

