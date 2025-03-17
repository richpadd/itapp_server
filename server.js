const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // For parsing JSON requests

// Connect to MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Your MySQL password
    database: 'puzzles'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// API Route
app.get('/api/test', (req, res) => {
    // Destructure the query parameters (e.g. id)
    const {id} = req.query;
    
    // Base query string
    let query = 'SELECT * FROM test';
    let conditions = [];
    
    // If the 'id' filter is provided, add it to the query
    if (id) {
        conditions.push(`id = ?`);
    }
      
    // If there are any conditions, join them with 'AND' and append to the query
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    // Execute the query with the parameters (use ? placeholders for safety)

    console.log(query)
    db.query(query, [id].filter(Boolean), (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});
app.listen(5000, () => {
    console.log('Server running on port 5000');
});