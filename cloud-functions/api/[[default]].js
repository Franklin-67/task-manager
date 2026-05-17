// EdgeOne Pages Cloud Function entry point
// This file handles all /api/* requests

// Must be set BEFORE requiring api.js so data.js uses /tmp/data
process.env.EDGEONE_PAGES = '1';

const express = require('express');
const apiRouter = require('../../backend/api');

const app = express();

app.use(express.json());

// Mount at both paths to handle EdgeOne routing variations
app.use('/', apiRouter);
app.use('/api', apiRouter);

app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = app;
