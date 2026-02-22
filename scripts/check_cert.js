
import https from 'https';

const options = {
  hostname: 'centraldedados.dev.br',
  port: 443,
  method: 'GET',
  rejectUnauthorized: false // Para pegar o erro de certificado se houver
};

const req = https.request(options, (res) => {
  console.log('StatusCode:', res.statusCode);
  const cert = res.socket.getPeerCertificate();
  if (cert && Object.keys(cert).length > 0) {
    console.log('Certificate Subject:', cert.subject);
    console.log('Certificate Issuer:', cert.issuer);
    console.log('Valid from:', cert.valid_from);
    console.log('Valid to:', cert.valid_to);
  } else {
    console.log('No certificate details available.');
  }
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.end();

