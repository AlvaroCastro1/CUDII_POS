const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/onboarding',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log("RESPONSE FORMAT:", body);
  });
});
req.write(JSON.stringify({
  businessName: 'Cudii Demo',
  branchName: 'Sucursal Centro',
  registerId: 'Caja 01',
  adminEmail: 'admin@cudii.demo',
  adminPass: 'admin123'
}));
req.end();
