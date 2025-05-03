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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Middleware to verify JWT token
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET_KEY, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// Admin login endpoint
app.post('/api/auth/login', async (req, res) => {
    // console.log(req.body);
    const { username, password } = req.body;

    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ? AND is_admin = TRUE',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password!'});
        }

        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password.trim());

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password!' });
        }

        const token = jwt.sign(
            { userID: user.user_id, username: user.username, isAdmin: true },
            JWT_SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error!' });
    }
});

// Submit a new complaint
app.post('/api/complaints', async (req, res) => {
    // console.log(req.body);
    const {
        fullName,
        email,
        phone,
        address,
        district,
        complaintTitle,
        complaintCategory,
        complaintDescription
    } = req.body;

    try {
        // check if user already exists
        const [rows] = await pool.execute(
            'SELECT user_id FROM users WHERE phone = ?',
            [phone]
        );

        let userID;
        if (rows.length === 0) {
            // create new user
            const [result] = await pool.execute(
                'INSERT INTO users (username, password, email, full_name, phone, address, district) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [phone, '', email, fullName, phone, address, district]
            );
            userID = result.insertId;
        } else {
            userID = rows[0].user_id;
        }

        // create new complaint
        const [result] = await pool.execute(
            'INSERT INTO complaints (user_id, title, description, category, district, status) VALUES (?, ?, ?, ?, ?, ?)',
            [userID, complaintTitle, complaintDescription, complaintCategory, district, 'Pending']
        );

        res.status(201).json({ message: 'Complaint submitted successfully!', complaintId: result.insertId });
    } catch (error) {
        console.error('Complaint submission error:', error);
        res.status(500).json({ message: 'Error submitting complaint!' });
    }
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