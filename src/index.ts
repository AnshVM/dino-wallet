import 'dotenv/config';
import express from 'express';
import transactionRoutes from './routes/transactions.js';
import accountRoutes from './routes/accounts.js';

const app = express();
app.use(express.json());

app.use('/api/transactions', transactionRoutes);
app.use('/api/accounts', accountRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  console.log(`dino-wallet running on port ${PORT}`);
});
