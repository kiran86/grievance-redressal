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

// Temporary route to reset admin password
app.post('/api/reset-admin-password', async (req, res) => {
    const newPassword = 'Admin@123';
    const saltRounds = 10;

    try {
        const hash = await bcrypt.hash(newPassword, saltRounds);

        const [result] = await pool.execute(
            'UPDATE users SET password = ? WHERE username = ?',
            [hash, 'admin']
        );
        res.json({ message: 'Password reset successfully!' });
    } catch (error) {
        console.error('Password reset error:', error);
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

// Get all complaints for admin
app.get('/api/complaints', authenticateJWT, async (req, res) => {
    try {
        const [complaints] = await pool.execute(`
            SELECT c.*, u.full_name, u.phone
            FROM complaints c
            JOIN users u ON c.user_id = u.user_id
            ORDER BY c.created_at DESC
        `);

        // Format response
        const formattedComplaints = complaints.map(complaint =>({
            ...complaint,
            user: {
                fullName: complaint.full_name,
                phone: complaint.phone
            }
        }));

        res.json(formattedComplaints);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ message: 'Failed to fetch complaints!' });
    }
});


// Get individual complaint details
app.get('/api/complaints/:id', authenticateJWT, async (req, res) => {
    const complaintId = req.params.id;

    try {
        const [complaints] = await pool.execute(`
            SELECT c.*, u.full_name, u.email, u.phone, u.address
            FROM complaints c
            JOIN users u
            ON c.user_id = u.user_id
            WHERE c.complaint_id = ?
        `, [complaintId]);

        if (complaints.length === 0) {
            return res.status(404).json({ message: 'Complaint not found!' });
        }

        res.json(complaints[0]);
    } catch (error) {
        console.log('Error fetching complaint: ', error);
        res.status(500).json({ message: 'Failed to fetch complaint' });
    }
});

// Update complaint status
app.put('/api/complaints/:id', authenticateJWT, async (req, res) => {
    const complaintId = req.params.id;
    const { status, action_taken } = req.body;

    if (!status || (status === 'Resolved' && !action_taken)) {
        return res.status(400).json({ message: 'Status and action taken are required for resolved complaints.' });
    }

    try {
        let query;
        let params;

        if (status === 'Resolved') {
            query = 'UPDATE complaints SET status = ?, action_taken = ?, resolved_at = CURRENT_TIMESTAMP WHERE complaint_id = ?';
            params = [status, action_taken, complaintId];
        } else {
            query = 'UPDATE complaints SET status = ? WHERE complaint_id = ?';
            params = [status, complaintId];
        }

        const [result] = await pool.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        res.json({ message: 'Complaint updated successfully.' });
    } catch (error) {
        console.error('Error updating complaint: ', error);
        res.status(500).json({ message: 'Failed to update complaint.' });
    }
});

// Get District-wise report
app.get('/api/reports/district-wise', authenticateJWT, async (req, res) => {
    try {
        const [report] = await pool.execute(`
            SELECT
                district AS district_name,
                SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_complaints,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_complaints,
                COUNT(*) AS total_complaints
            FROM complaints
            GROUP BY district
            ORDER BY district
        `);

        res.json(report);
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ message: 'Failed to generate report.' })
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