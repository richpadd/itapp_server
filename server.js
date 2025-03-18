
// Request all necessary packages
require('dotenv').config();             // Dotenv package for retrieving environment variables (login credentials) more securely
const express = require('express');     // Express server package
const mysql = require('mysql2');        // MySQL package for database integration
const cors = require('cors');           // Cross-Origin Resource Sharing package for managing access

const app = express();
app.use(cors());
app.use(express.json()); // For parsing JSON requests

// Connect to the MariaDB MySQL using the credentials from the .env file
const db = mysql.createConnection({
    host: process.env.DB_HOST,        
    user: process.env.DB_USER,        
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME    
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
    let query = 'SELECT * FROM test_table';
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