const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');

require('dotenv').config();
const { ObjectId } = require('mongodb');
const MongoClient = require("mongodb").MongoClient;
const mongoUri = process.env.MONGO_URI;

const jwt = require('jsonwebtoken');
const generateAccessToken = (id, email) => {
    return jwt.sign({
        'user_id': id,
        'email': email
    }, process.env.TOKEN_SECRET, {
        expiresIn: "4h"
    });
}

const app = express();
app.use(express.json());
app.use(cors());

// add routes here
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await db.collection('users').findOne({ email: email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    const accessToken = generateAccessToken(user._id, user.email);
    res.json({ accessToken: accessToken });
  });
  
  async function main() {
    // other routes not shown
  
    app.post('/users', async function (req, res) {
      const result = await db.collection("users").insertOne({
          'email': req.body.email,
          'password': await bcrypt.hash(req.body.password, 12)
      })
      res.json({
          "message": "New user account",
          "result": result
      })
    })
  }

// app.get('/', function(req,res){
//     res.json({
//        "message":"hello world"
//     });
// })

// app.get('/hello/:name', (req,res)=>{
//     let name = req.params.name;
//     res.send("Hi, " + name);
//   })

//   app.get('/echo', (req, res) => {
//     const queryParams = req.query;

//     const response = {
//         message: "Here are the query parameters you sent:",
//         firstName: queryParams.firstName,
//         lastName: queryParams.lastName
//     };

//     res.json(response);
// });

// Create a route name with the difference and it takes in two route parameters, n1 and n2 and sends back to the client their differences.
// app.get('/difference/:n1/:n2', (req, res) => {
//     const n1 = parseFloat(req.params.n1);
//     const n2 = parseFloat(req.params.n2);

//     const difference = n1 - n2;

//     res.json({
//         message: `The difference between ${n1} and ${n2} is:`,
//         difference: difference
//     });
// });


// Create a route named scream and it takes in a query string with two keys, message and recipient and sends back to the client the two texts combined but in uppercase.
// app.get('/scream/:message/:recipient', (req, res) => {
//     const message = req.params.message;
//     const recipient = req.params.recipient;

//     const scream = (message + " " + recipient + "!").toUpperCase();

//     res.json(scream);
// });


  


// MARK: Starting server. ALWAYS LAST
app.listen(3000, ()=>{
    console.log("Server started")
})
