require('dotenv').config();
const express = require('express');
const bodyPerser = require('body-parser');
const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const req = require('express/lib/request');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Enable static file serving
app.use(express.static('public'));

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET_KEY, (err, user) => {
            if (err) {
                return res.sendStatus(403); // Forbidden
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401); // Unauthorized
    }
};

// Serve main page
app.get('/', (req, res) => {
    res.sendFile('/public/index.html');
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Error logging
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString}`, err.stack);
    res.status(500).send('Something broken!');
});

// Start the server
app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});