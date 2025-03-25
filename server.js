// ----------------------------------------------------------------------------
// ITMD-504 - Programming and Application Foundations
// Final Project - Puzzle Checker
// Richard Paddock (A20603128)
// ----------------------------------------------------------------------------
// File: app/server.js
// Descripton: This is the node.js server main fle, it includes - 
// - Config/startup for express to serve the back-end node.js code
// - The back-end node.js API code
// ----------------------------------------------------------------------------
// 
// NODE Package management

// Request all necessary packages
require('dotenv').config();                         // Dotenv package for retrieving our environment variables
const express = require('express');                 // Express server package
const session = require("express-session");         // Express-session for handling session management
const bcrypt = require("bcryptjs");                 // For encryption
const mysql = require('mysql2');                    // MySQL package for database integration
const cors = require('cors');                       // Cross-Origin Resource Sharing package for managing access
const path = require('path');                       // Add in path methods

const app = express();
//app.use(cors());
app.use(express.json());                            // For handling JSON 
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    // origin: 'http://localhost:5500', // Update with your frontend's port
    credentials: true // Allow credentials (cookies, authorization headers)
}));


// ---------------------------------------------------------------------------
// SERVER Configuration and Startup

// Start the server for the API on Port 3000 and for use by localhost only (i.e. the app or admin) for security 
const apiPort = 3000;
app.listen(apiPort, '0.0.0.0', () => {
  console.log(`API server is running on http://localhost:${apiPort}`);
});

// ---------------------------------------------------------------------------
// DATABASE SETUP AND CONNECT

// Configure session middleware
app.use(
    session({
      secret: "your-secret-key", // Change this to a secure secret key
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }, // Set to true if using HTTPS
    })
  );

// Mock user database
const users = [{ username: "admin", password: bcrypt.hashSync("password", 10) }];

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

// ---------------------------------------------------------------------------
// Session Management

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Replace with actual authentication logic
    if (username === 'user' && password === 'password') {
      req.session.user = username;
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });
  
  // Logout endpoint
  app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.json({ success: false });
      }
      res.clearCookie('connect.sid'); // Clear session cookie
      res.json({ success: true });
    });
  });
  
  // Check login status endpoint
  app.get('/api/status', (req, res) => {
    if (req.session.user) {
      res.json({ loggedIn: true, user: req.session.user });
    } else {
      res.json({ loggedIn: false });
    }
  });

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS

// Check if a Term already exists 
const checkTerm = async (termName) => {
    return new Promise((resolve, reject) => {
      const checkTermQuery = 'SELECT id FROM terms WHERE name = ?';
      db.query(checkTermQuery, [termName], (err, results) => {
        if (err) return reject('500');                                  // Return general error
        if (results.length > 0) return resolve('409');                  // Return already exists - conflict status
        resolve('200');                                                 // Return success :)
      });
    });
  };

// Return the category ID from name
const getCatID = async (catName) => {
    return new Promise((resolve, reject) => {
      const checkCatQuery = 'SELECT id FROM categories WHERE name = ? LIMIT 1';
  
      db.query(checkCatQuery, [catName], (err, results) => {
        if (err) return reject('500');                                  // Return general error
        if (results.length > 0) return resolve(results[0].id);          // Return id as succcess :)
        resolve('404');                                                 // Return not found status
      });
    });
  };

// --------------------------------------------------------------------------
// API Section

//---------------------------------------------------------------------------
// API - GET terms
// Returns - id, category name, term name, definition and alternatives ordered by category and term (JSON)
// Parameters - Optional: category_id, term_name 
// --------------------------------------------------------------------------

app.get('/api/terms', (req, res) => {
    
    // Get any incoming query parameters - category = the category ID or name = a full or partial term name
    const queryParams = req.query || {}; 

    // Extract any passed-in parameters with default values
    const category_id = queryParams.category_id || null;
    const category_name = queryParams.category_name || '';
    const term_name = queryParams.term_name || '';
    
    // Set the initial SQL
    let query = 'SELECT categories.id as catid, categories.name as catname, terms.id as termid, terms.name as termname, terms.definition, ' +
                'terms.alt1, terms.alt2, terms.alt3 FROM categories, terms WHERE terms.category_id = categories.id' 
    let querysort =' ORDER BY categories.id, terms.name;'

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
    
    // Category Name has been passed so add it to our query as a category filter
    if (category_name){
        // If name is too long then return an error (a safety check)
        if (category_name.length>100){
            return res.status(400).json({ error: 'Invalid category name' });}
        else {
            query += ' AND categories.name=?'
            queryParameters.push(category_name);
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
            res.status(500).json({ error: 'Error selecting on terms: ' + err.message });
            return;
        }
        res.json(results);
    });
}); 

//---------------------------------------------------------------------------
// API - POST - Insert a new term
// Returns - Success or failure result
// Parameters - term name, category name, definition, alternative quiz defintions x 3 (can be blank to exclude from quiz) 
// --------------------------------------------------------------------------

app.post('/api/terms', async (req, res) => {
    const {termname, catname, definition,alt1,alt2,alt3} = req.body;
    inquiz = 1;
    catid = 1;

    // Check all required parameters have been passed 
    if (termname == null || catname == null, definition == null || alt1 == null || alt2 == null || alt3 == null ) {
        res.status(400).json({error: 'Incorrect parameters passed'});
        return;
    } 

    // Check if this exact term already exists 
    const checkResult = await checkTerm(termname);
    console.log(checkResult);
    if (checkResult!='200'){
        res.status(409).json({ error: 'This term name already exists'});
        return;
    } 

    // Check the category exists and get it's ID
    const categoryID = await getCatID(catname);
    console.log(categoryID);
    if (categoryID == '404'|| categoryID == '500' ) {
        res.status(404).json({ error: 'Error occured on category lookup'});
        return;} 
    else {catid = categoryID;}

    // If any alts are blank this will deactive the quiz
    if ( alt1 == "" || alt2 == "" || alt3 == "" ) {inquiz = 0;}

    // All good - Let's insert the new term
    const insertTermQuery = 'INSERT INTO terms (name, category_id, definition, inquiz, alt1, alt2, alt3) VALUES(?, ?, ?, ?, ?, ?, ?)'
    // Output query string to the console for checking
    console.log(insertTermQuery);
    db.query(insertTermQuery, [termname, catid, definition, inquiz, alt1, alt2, alt3], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            console.log(err.message);
            return;
        }
        res.status(201).json({message: 'New Item Created',id: result.insertId});
    });
});

//---------------------------------------------------------------------------
// API - PUT - Update an existing term
// Returns - Success or failure result
// Parameters - term id, term name, category name, definition, alternative quiz defintions x 3 (can be blank to exclude from quiz) 
// --------------------------------------------------------------------------

app.put('/api/terms', async (req, res) => {
    const {termid, termname, catname, definition,alt1,alt2,alt3} = req.body;
    inquiz = 1;
    catid = 1;

    // Check all required parameters have been passed 
    if (termid == null || termname == null || catname == null, definition == null || alt1 == null || alt2 == null || alt3 == null ) {
        res.status(400).json({error: 'Incorrect parameters passed'});
        return;
    } 

   // Check the category exists and get it's ID
    const categoryID = await getCatID(catname);
    console.log(categoryID);
    if (categoryID == '404'|| categoryID == '500' ) {
        res.status(404).json({ error: 'Error occured on category lookup'});
        return;} 
    else {catid = categoryID;}

    // If any alts are blank this will deactive the quiz
    if ( alt1 == "" || alt2 == "" || alt3 == "" ) {inquiz = 0;}

    // All good - Let's update this term
    const insertTermQuery = 'UPDATE terms SET name=?, category_id=?, definition=?, inquiz=?, alt1=?, alt2=?, alt3=? WHERE id=?';
    // Output query string to the console for checking
    console.log(insertTermQuery);
    db.query(insertTermQuery, [termname, catid, definition, inquiz, alt1, alt2, alt3, termid], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            console.log(err.message);
            return;
        }
        res.status(200).json({message: 'Record Updated Successfully'});
    });
});

//---------------------------------------------------------------------------
// API - DELETE existing term
// Parameters - term ID to delete
// --------------------------------------------------------------------------

app.delete('/api/terms/', (req, res) => {
    const {termid} = req.body;
    console.log(termid);
    const deleteQuery = 'DELETE FROM terms WHERE id = ?';
    console.log(deleteQuery);
    db.query(deleteQuery, [termid], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            console.log(err.message);
            return;
        }
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Term not found' });
            return;
        }
        res.status(200).json({ message: 'Item Removed'});
    });
});

//---------------------------------------------------------------------------
// API - GET categories
// Returns - category id and category names ordered alphabetically
// Return Format - JSON
// Parameters - None
// --------------------------------------------------------------------------

app.get('/api/categories', (req, res) => {  
    // Set the initial SQL
    let catQuery = 'SELECT id, name FROM categories ORDER BY name';

    // Execute the query using our prepared SQL with parameterized queries to avoid SQL injection
    db.query(catQuery, (err, results) => {  
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});