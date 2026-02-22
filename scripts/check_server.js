async function checkServer() {
    const url = 'https://centraldedados.dev.br/api/health';
    try {
        console.log('Checking health at:', url);
        const res = await fetch(url);
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkServer();

