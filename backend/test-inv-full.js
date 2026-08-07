const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:3000/auth/login', { email: 'admin@empresa1.com', password: 'Password123!' });
    const token = res.data.access_token;
    const inv = await axios.get('http://localhost:3000/inventory/stock/all?page=1&limit=20&search=&incluirInactivos=true', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Stock API Status:', inv.status);
    console.log('Returned items:', inv.data.data.length);
  } catch (err) {
    if (err.response) {
      console.error('API Error:', err.response.status, err.response.data);
    } else {
      console.error('Network Error:', err.message);
    }
  }
}
test();
