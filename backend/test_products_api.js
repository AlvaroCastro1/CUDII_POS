const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const token = JSON.parse(body).access_token;
    http.get({
      hostname: 'localhost',
      port: 3000,
      path: '/products?page=1&limit=2',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res2) => {
      let body2 = '';
      res2.on('data', chunk => body2 += chunk);
      res2.on('end', () => {
        console.log("RESPONSE FORMAT:", body2);
      });
    });
  });
});
req.write(JSON.stringify({email: 'admin@cudii.demo', password: 'password123'}));
req.end();
