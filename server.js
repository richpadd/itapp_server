// ----------------------------------------------------------------------------
// ITMD-504 - Programming and Application Foundations
// Final Project - Puzzle Checker
// Richard Paddock (A20603128)
// ----------------------------------------------------------------------------
// File: server.js
// Descripton: This is the node.js server main fle, it includes - 
// - Config/startup for express to serve the front-end react app
// - Config/startup for express to serve the back-end node.js code
// - The back-end node.js API code
// ----------------------------------------------------------------------------
// 
// NODE Package management

// Request all necessary packages
require('dotenv').config();             // Dotenv package for retrieving our environment variables
const express = require('express');     // Express server package
const mysql = require('mysql2');        // MySQL package for database integration
const cors = require('cors');           // Cross-Origin Resource Sharing package for managing access
const path = require('path');           // Add in path methods

const app = express();
app.use(cors());
app.use(express.json());                // For handling JSON 

// ---------------------------------------------------------------------------
// SERVER Configuration and Startup

// Front-end: Set it to serve the static files from my React app build folder
const buildPath = path.join(__dirname, '../client/build');
console.log('Serving static files from:', buildPath);
app.use(express.static(buildPath));

// Start the server on port 5000 for the React app and set it so that it is publicly accessible - Secured by AWS security group
const publicPort = process.env.PORT || 5000;
app.listen(publicPort, '0.0.0.0', () => {
  console.log(`React app is running on http://0.0.0.0:${publicPort}`);
});

// Back-end: Start the server for the API on Port 3000 and for use by localhost only (i.e. the app or admin) for security 
const apiPort = 3000;
app.listen(apiPort, '127.0.0.1', () => {
  console.log(`API server is running on http://localhost:${apiPort}`);
});

// ---------------------------------------------------------------------------
// DATABASE SETUP AND CONNECT

// Connect to our MariaDB MySQL using the credentials from the environment (.env) file
const db = mysql.createConnection({
    host: process.env.DB_HOST,        
    user: process.env.DB_USER,        
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME    
});

// Provide an error/success message 
db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to our MariaDB!');
});

// --------------------------------------------------------------------------
// API's

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