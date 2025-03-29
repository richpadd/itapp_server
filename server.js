// ----------------------------------------------------------------------------
// ITMD-504 - Programming and Application Foundations
// Final Project - IT Terms
// Richard Paddock (A20603128)
// ----------------------------------------------------------------------------
// File: app/server.js
// Descripton: This is the node.js server main fle, it includes - 
// - Config/startup for express to serve the back-end node.js code
// - Server login and authentication control
// - The back-end API code
// - Logging code (all API results logged a text file)
// ----------------------------------------------------------------------------
// 
// NODE Package management

// Request all necessary packages
require('dotenv').config();                         // Dotenv package for retrieving our environment variables
const express = require('express');                 // Express server package
const session = require("express-session");         // Express-session for handling session management
const cors = require('cors');                       // Cross-Origin Resource Sharing package for managing access
const mysql = require('mysql2');                    // MySQL package for database integration
const fs = require('fs');                           // Add in File System module for text file handling
const path = require('path');                       // Add in path methods

// ---------------------------------------------------------------------------
// SERVER Configuration and Startup

const app = express();
app.use(express.json());                                                // For handling JSON 
const inDevelopment = process.env.MODE === 'development';               // Holds whether in development or production based on ENV variable setting
console.log(inDevelopment);

// Securing our API usage through Cross-Origin Resource Sharing
// - Applies protected CORS to authenticated routes (all DB write functions) using 'api' path
// - Applies public CORS only allow non-authenticated routes (GET read-only) using 'public-api' path
// - Restrics access to all routes to receive only our from our domain (set in the environment file)
// - Disabled when in development mode

if (!inDevelopment) {
    // Public setup
    const publicCors = cors({
        origin: process.env.WEBSERVER_URL,                               
        credentials: false, 
        allowedHeaders: ['Content-Type']
    });
    app.use('/public-api', publicCors);                                  // Apply public CORS only allow non-authenticated routes (GET read-only) 

    // Protected setup
    const protectedCors = cors({
        origin: process.env.WEBSERVER_URL,                              
        credentials: true, 
        allowedHeaders: ['Content-Type', 'Authorization']
    });
    app.use('/api', protectedCors);                                      // Apply protected CORS to authenticated routes
}
else {app.use(cors());}                                                  // Development mode only allows all origins through

// Start the server for the API on path as per the environment settings, and bind only to localhost to improve security
const apiPort = process.env.LISTEN_PORT;
app.listen(apiPort, 'localhost', () => {
  console.log(`API server is running on http://localhost:${apiPort}`);
  logAction('API server started');
});

// ---------------------------------------------------------------------------
// DATABASE SETUP AND CONNECT

// Connect to our MariaDB MySQL using the credentials from the environment file
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
        logAction('Database connection failed');
        return;
    }
    console.log('Connected to our',process.env.DB_NAME,'database');
    logAction('Database connection successful');
});

// ---------------------------------------------------------------------------
// Session & Login Management

// Configure session middleware
app.use(
    session({
      secret: process.env.SECRET_WORD,
      resave: false,
      saveUninitialized: true,
      cookie: {secure: false },
    })
  );

// Login - Given this is just a test prototype we store user and passowrd in the environment settings file
app.post("/api/login", (req, res) => {
    if (req.body.username === process.env.APP_USER && req.body.password === process.env.APP_PASSWORD) {
        req.session.user = process.env.APP_USER;
        logAction('Login successful by user:'+req.body.username);                 // Output status to the log
        return res.json({ message: "Logged in" });
    }
    logAction('Login attempt failed by user:'+req.body.username);                 // Output status to the log
    res.status(401).json({ message: "Wrong credentials" });
});

// Check Auth
app.get("/api/auth", (req, res) => {
    if (req.session.user) return res.json({ user: req.session.user });
    res.status(401).json({ message: "Not logged in" });
});

// Middleware function to check authentication status prior to other API calls
function isAuthenticated(req, res, next) {
  logAction('Authentication requested');                                          // Output status to the log
  if (req.session.user) {
      next();  // Proceed to the protected route if authenticated
  } else {
      res.status(401).json({ message: "Not logged in" });
  }
}

// Logout
app.post("/api/logout", (req, res) => {
    logAction('User logged out');                                                 // Output status to the log
    req.session.destroy(() => res.json({ message: "Logged out" }));
});

// ---------------------------------------------------------------------------
// HELPER function section

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

// Logging Function - Logs all key events to external text file
const logAction = (loginfo) => {

    // Define the text file log name, formats as path/LOG-YYYY-MM-DD.txt
    const today = new Date();
    const logFileName = `LOG-${today.toISOString().slice(0, 10)}.txt`;
    const logFilePath = path.join(process.env.LOG_PATH, logFileName); 

    // Writes date and passed-in log info to the text file log - creating the file if it doesn't already exist
    try {
        fs.appendFileSync(logFilePath, today + ': '+ loginfo+'\n', 'utf8');
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
}

// --------------------------------------------------------------------------
// API Section

//---------------------------------------------------------------------------
// API - GET terms (Publically Accessible)
// Returns - id, category name, term name, definition and alternatives ordered by category and term
// --------------------------------------------------------------------------

app.get('/public-api/terms', (req, res) => {
    
    // Set the initial SQL
    let query = 'SELECT categories.id as catid, categories.name as catname, terms.id as termid, terms.name as termname, terms.definition, ' +
                'terms.alt1, terms.alt2, terms.alt3 FROM categories, terms WHERE terms.category_id = categories.id' 
    let querysort =' ORDER BY categories.id, terms.name;'

    // Add sort terms to the query
    query += querysort;

    // Execute the query using our prepared SQL with parameterised queries to avoid SQL injection and return the result
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: 'Error selecting on terms: ' + err.message });     // Return general error 
            return;
        }
    logAction('Terms list returned');                                                        // Output request to the log
    res.status(200).json({ success: true, data: results });                                 // Return success code and our result set
    });
}); 

//---------------------------------------------------------------------------
// API - POST - Insert a new term (Authentication Required)
// Parameters - term name, category name, definition, alternative quiz defintions x 3 (can be blank to exclude from quiz) 
// --------------------------------------------------------------------------

app.post('/api/terms',isAuthenticated, async (req, res) => {
    const {termname, catname, definition,alt1,alt2,alt3} = req.body;
    inquiz = 1;
    catid = 1;

    // Check all required parameters have been passed 
    if (termname == null || catname == null, definition == null || alt1 == null || alt2 == null || alt3 == null ) {
        res.status(400).json({error: 'Incorrect parameters passed'});              // Return a bad request error
        return;
    } 

    // Check if this exact term already exists 
    const checkResult = await checkTerm(termname);
    if (checkResult!='200'){
        res.status(409).json({ error: 'This term name already exists'});           // Return a Conflict error - already exists
        return;
    } 

    // Check the category exists and get it's ID
    const categoryID = await getCatID(catname);
    if (categoryID == '404'|| categoryID == '500' ) {                              // Return a not found - on category
        res.status(404).json({ error: 'Error occured on category lookup'});
        return;} 
    else {catid = categoryID;}

    // If any alts are blank this will deactive the quiz
    if ( alt1 == "" || alt2 == "" || alt3 == "" ) {inquiz = 0;}

    // All good - Let's insert the new term
    const insertTermQuery = 'INSERT INTO terms (name, category_id, definition, inquiz, alt1, alt2, alt3) VALUES(?, ?, ?, ?, ?, ?, ?)' 
    db.query(insertTermQuery, [termname, catid, definition, inquiz, alt1, alt2, alt3], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });                         // Return a general error
            return;
        }
        logAction('Term inserted: '+termname);                                    // Output request to the log
        res.status(201).json({message: 'New Item Created',id: result.insertId});  // Return success! 
    });
});

//---------------------------------------------------------------------------
// API - PUT - Update an existing term (Authentication Required)
// Parameters - term id, term name, category name, definition, alternative quiz defintions x 3 (can be blank to exclude from quiz) 
// --------------------------------------------------------------------------

app.put('/api/terms',isAuthenticated, async (req, res) => {
    const {termid, termname, catname, definition,alt1,alt2,alt3} = req.body;
    inquiz = 1;
    catid = 1;

    // Check all required parameters have been passed 
    if (termid == null || termname == null || catname == null, definition == null || alt1 == null || alt2 == null || alt3 == null ) {
        res.status(400).json({error: 'Incorrect parameters passed'});               // Return a bad request error
        return;
    } 

   // Check the category exists and get it's ID
    const categoryID = await getCatID(catname);
    if (categoryID == '404'|| categoryID == '500' ) {
        res.status(404).json({ error: 'Error occured on category lookup'});         // Return a not found - on category error
        return;} 
    else {catid = categoryID;}

    // If any alts are blank this will deactive the quiz
    if ( alt1 == "" || alt2 == "" || alt3 == "" ) {inquiz = 0;}

    // All good - Let's update this term
    const updateTermQuery = 'UPDATE terms SET name=?, category_id=?, definition=?, inquiz=?, alt1=?, alt2=?, alt3=? WHERE id=?';
    db.query(updateTermQuery, [termname, catid, definition, inquiz, alt1, alt2, alt3, termid], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            console.log(err.message);
            return;
        }
        logAction('Term updated: ID: '+termid);                                      // Output request to the log
        res.status(200).json({message: 'Record Updated Successfully'});            // Return success!
    });
});

//---------------------------------------------------------------------------
// API - DELETE existing term (Authentication Required)
// Parameters - term ID to delete
// --------------------------------------------------------------------------

app.delete('/api/terms/',isAuthenticated, (req, res) => {
    const {termid} = req.body;
    const deleteQuery = 'DELETE FROM terms WHERE id = ?';
    db.query(deleteQuery, [termid], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });                          // Return a general error 
            console.log(err.message);
            return;
        }
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Term not found' });                   // Retun a not found on term
            return;
        }
        logAction('Term deleted: ID: '+termid);                                    // Output request to the log
        res.status(200).json({ message: 'Item Removed'});                          // Return success!
    });
});

//---------------------------------------------------------------------------
// API - GET categories ((Publically Accessible))
// Returns - category id and category names ordered alphabetically 
// Parameters - None
// --------------------------------------------------------------------------

app.get('/public-api/categories', (req, res) => {                         
    // Set the initial SQL and run it
    let catQuery = 'SELECT id, name FROM categories ORDER BY name';
    db.query(catQuery, (err, results) => {  
        if (err) {
            res.status(500).json({ error: err.message });                         // Return a general error
            return;
        }
        logAction('Category list returned');                                       // Output request to the log
        res.status(200).json({ success: true, data: results });                   // Return success code and our result set
    });
});