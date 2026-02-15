import PocketBase from 'pocketbase';

const pb = new PocketBase('https://centraldedados.duckdns.org');

const adminEmail = 'fabio.h.c.costa@gmail.com';
const adminPass = 'Opala7980';

async function checkRules() {
  try {
    console.log('Attempting Admin Auth...');
    // Try old style admin auth first
    try {
      await pb.admins.authWithPassword(adminEmail, adminPass);
      console.log('Admin Auth Successful (via admins)!');
    } catch (e1) {
      console.log('Admin Auth via admins failed, trying _superusers...');
      try {
        await pb.collection('_superusers').authWithPassword(adminEmail, adminPass);
        console.log('Admin Auth Successful (via _superusers)!');
      } catch (e2) {
        console.error('All Admin Auth methods failed.');
        console.error('Admins Error:', e1.message);
        console.error('_superusers Error:', e2.message);
        return;
      }
    }

    // If we are here, we are authenticated
    const collection = await pb.collections.getOne('agenda_cap53_notifications');
    console.log('Collection: agenda_cap53_notifications');
    console.log('Create Rule:', collection.createRule);
    console.log('Update Rule:', collection.updateRule);
    console.log('Delete Rule:', collection.deleteRule);

    // Check if we need to update
    if (collection.createRule !== '' && collection.createRule !== null) {
        console.log('Create rule is restricted. This might be the issue.');
        // Update it to allow any authenticated user to create notifications
        // Ideally: user = @request.auth.id (only for self) OR @request.auth.id != "" (any user)
        // For a notification system where users notify others, we usually need @request.auth.id != ""
        // But to be safe, let's see what it is first.
    }

  } catch (error) {
    console.error('Fatal Error:', error);
  }
}

checkRules();
