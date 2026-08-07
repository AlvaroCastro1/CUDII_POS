const axios = require('axios');
async function test() {
  try {
    const loginRes = await axios.post('http://localhost:3000/auth/login', { email: 'admin@empresa1.com', password: 'Password123!' });
    const token = loginRes.data.access_token;
    console.log('Token OK');
    const res = await axios.get('http://localhost:3000/inventory/stock/all?page=1&limit=20&search=&incluirInactivos=true', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Success!', res.status, res.data);
  } catch(e) {
    console.error('Error!', e.response?.status, e.response?.data || e.message);
  }
}
test();
