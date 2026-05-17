const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRouter = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend static files from project root
const rootDir = path.join(__dirname, '..');
app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
});
app.get('/script.js', (req, res) => {
    res.sendFile(path.join(rootDir, 'script.js'));
});
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(rootDir, 'style.css'));
});

app.use('/api', apiRouter);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Task Manager Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
