app.get('/paystack/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    res.json(response.data);
  } catch (err) {
    console.error('Paystack verify error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

const PAYSTACK_SECRET_KEY = 'sk_test_2817fe763384799c1fa39ade9b4454d6bca0b9e6';

app.post('/paystack/init', async (req, res) => {
  const { email, amount } = req.body;
  try {
    const callback_url = `sachio://order?reference=${Math.floor(Math.random()*1000000000)}`; // Deep link to your app's order page with reference
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email, amount, currency: 'NGN', callback_url },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    res.json({ url: response.data.data.authorization_url, reference: response.data.data.reference });
  } catch (err) {
    console.error('Paystack error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.listen(5000, () => console.log('Backend running on port 5000'));
