// EdgeOne Pages Cloud Function entry point
// This file handles all /api/* requests

// Must be set BEFORE requiring api.js so data.js uses /tmp/data
process.env.EDGEONE_PAGES = '1';

const express = require('express');
const apiRouter = require('../../backend/api');

const app = express();

app.use(express.json());
app.use('/', apiRouter);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
