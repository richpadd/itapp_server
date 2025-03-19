// ----------------------------------------------------------------------------
// ITMD-504 - Programming and Application Foundations
// Final Project - Puzzle Checker
// Richard Paddock (A20603128)
// ----------------------------------------------------------------------------
// File: app/server.js
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

// Start the server for the API on Port 3000 and for use by localhost only (i.e. the app or admin) for security 
const apiPort = 3000;
app.listen(apiPort, '0.0.0.0', () => {
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

console.log('Connecting to',process.env.DB_NAME);

// Provide an error/success message 
db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to our',process.env.DB_NAME,'database');
});

// --------------------------------------------------------------------------
// The API Section

//---------------------------------------------------------------------------
// API - GET terms
// Returns - category name, term name and term definition ordered by category and term
// Return Format - JSON
// Parameters - Optional: category_id, term_name 
// --------------------------------------------------------------------------

app.get('/api/terms', (req, res) => {
    
    // Get any incoming query parameters - category = the category ID or name = a full or partial term name
    const queryParams = req.query || {}; 

    // Extract any passed-in parameters with default values
    const category_id = queryParams.category_id || null;
    const term_name = queryParams.term_name || '';
    
    // Set the initial SQL
    let query = 'SELECT categories.name AS category, terms.name, terms.definition FROM categories, terms WHERE terms.category_id = categories.id' 
    let querysort =' ORDER BY categories.id, terms.id;'

    // Process any incoming parameters
    let queryParameters = [];

    // Category ID has been passed so add it to our query as a category filter, unless it's not a number in which case return an error (a safety check)
    if (category_id) {
        if (isNaN(category_id)){
            return res.status(400).json({ error: 'Invalid category_id' });}
        else {
            query += ' AND categories.id=?'
            queryParameters.push(category_id);
        }
    }
    
    // Term Name has been passed so add it to our query as a like so we can search on a partial match too (Our DB collation is case insenstive)
    if (term_name) {
        // If name is too long then return an error (a safety check)
        if (term_name.length>100){
            return res.status(400).json({ error: 'Invalid term name' });}
        else {
            query += ' AND terms.name LIKE ?'
            queryParameters.push(`${term_name}%`);
        }
    }

    // Add sort terms to the query
    query += querysort;

    // Output query to the log for checking
    console.log(query)

    // Execute the query using our prepared SQL with parameterised queries to avoid SQL injection and return the result
    db.query(query, queryParameters, (err, results) => {
    if (err) {
        res.status(500).json({ error: err.message });
        return;
    }
    res.json(results);
    }); 
// --------------------------End of GET terms API

//---------------------------------------------------------------------------
// API - GET categories
// Returns - category names ordered alphabetically
// Return Format - JSON
// Parameters - None
// --------------------------------------------------------------------------

app.get('/api/categories', (req, res) => {  
    // Set the initial SQL
    let query = 'SELECT name FROM categories ORDER BY name';

    // Execute the query using our prepared SQL with parameterized queries to avoid SQL injection
    db.query(query, (err, results) => {  
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});
// --------------------------End of GET categories API

});