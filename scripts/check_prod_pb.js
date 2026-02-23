const PB_URL = 'https://centraldedados.dev.br';

console.log(`Testando conexão com ${PB_URL}...`);

fetch(`${PB_URL}/api/health`)
  .then(res => {
    console.log(`Status: ${res.status}`);
    if (res.ok) {
        return res.json().then(data => {
            console.log('Health Check OK:', data);
        }).catch(() => {
            console.log('Health Check OK (sem JSON body)');
        });
    } else {
        console.error('Falha no Health Check');
    }
  })
  .catch(err => {
    console.error('Erro de conexão:', err.message);
  });
