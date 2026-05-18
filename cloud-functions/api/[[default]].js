// EdgeOne Pages Cloud Function — ES module entry point
process.env.EDGEONE_PAGES = '1';

import express from 'express';
import apiRouter from '../../backend/api.js';

const app = express();

app.use(express.json());
app.use('/', apiRouter);
app.use('/api', apiRouter);

app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default app;
