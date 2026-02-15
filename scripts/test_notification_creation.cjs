const { pb } = require('./test_connection_simple.cjs');

async function testNotificationCreation() {
  try {
    console.log('🧪 Testando criação de notificações no banco remoto\n');
    
    // 1. Buscar usuário Almoxarifado
    console.log('1. Buscando usuário Almoxarifado...');
    const almcUsers = await pb.collection('users').getList(1, 5, {
      filter: 'role = "ALMC"'
    });
    
    if (almcUsers.items.length === 0) {
      console.log('❌ Nenhum usuário Almoxarifado encontrado');
      return;
    }
    
    const almcUser = almcUsers.items[0];
    console.log(`✅ Usuário Almoxarifado: ${almcUser.email} (ID: ${almcUser.id})`);
    
    // 2. Criar uma notificação de teste
    console.log('\n2. Criando notificação de teste...');
    
    const testNotification = {
      user: almcUser.id,
      title: 'Teste de Notificação',
      message: 'Esta é uma notificação de teste para verificar se o sistema está funcionando.',
      type: 'almc_item_request',
      read: false,
      invite_status: 'pending',
      acknowledged: false
    };
    
    console.log('Dados da notificação:', testNotification);
    
    try {
      const created = await pb.collection('agenda_cap53_notifications').create(testNotification);
      console.log('✅ Notificação criada com sucesso!');
      console.log('ID da notificação:', created.id);
      console.log('Título:', created.title);
      console.log('Usuário:', created.user);
      console.log('Tipo:', created.type);
    } catch (createError) {
      console.error('❌ Erro ao criar notificação:', createError.message);
      console.error('Detalhes do erro:', createError.data || createError);
    }
    
    // 3. Verificar se a notificação foi criada
    console.log('\n3. Verificando notificações do usuário...');
    const userNotifications = await pb.collection('agenda_cap53_notifications').getList(1, 10, {
      filter: `user = "${almcUser.id}"`,
      sort: '-created'
    });
    
    console.log(`📊 Total de notificações para este usuário: ${userNotifications.totalItems}`);
    
    if (userNotifications.items.length > 0) {
      console.log('\nÚltimas notificações:');
      userNotifications.items.slice(0, 3).forEach((notif, index) => {
        console.log(`${index + 1}. ${notif.title} (${notif.type}) - ${new Date(notif.created).toLocaleString()}`);
      });
    }
    
    // 4. Verificar permissões da coleção
    console.log('\n4. Verificando esquema da coleção...');
    try {
      const schema = await pb.collections.getOne('agenda_cap53_notifications');
      console.log('✅ Coleção encontrada:', schema.name);
      console.log('Campos:', schema.schema.map(field => field.name).join(', '));
    } catch (schemaError) {
      console.error('❌ Erro ao verificar esquema:', schemaError.message);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testNotificationCreation();