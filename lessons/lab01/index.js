const express = require('express');
const cors = require('cors');

let app = express();
app.use(cors());

// add routes here
app.get('/', function(req,res){
    res.json({
       "message":"hello world"
    });
})

app.get('/hello/:name', (req,res)=>{
    let name = req.params.name;
    res.send("Hi, " + name);
  })

  app.get('/echo', (req, res) => {
    const queryParams = req.query;

    const response = {
        message: "Here are the query parameters you sent:",
        firstName: queryParams.firstName,
        lastName: queryParams.lastName
    };

    res.json(response);
});

// Create a route name with the difference and it takes in two route parameters, n1 and n2 and sends back to the client their differences.
app.get('/difference/:n1/:n2', (req, res) => {
    const n1 = parseFloat(req.params.n1);
    const n2 = parseFloat(req.params.n2);

    const difference = n1 - n2;

    res.json({
        message: `The difference between ${n1} and ${n2} is:`,
        difference: difference
    });
});


// Create a route named scream and it takes in a query string with two keys, message and recipient and sends back to the client the two texts combined but in uppercase.
app.get('/scream/:message/:recipient', (req, res) => {
    const message = req.params.message;
    const recipient = req.params.recipient;

    const scream = (message + recipient + "!").toUpperCase();

    res.json(scream);
});


// MARK: Always last code of RESTFul API
app.listen(3000, ()=>{
    console.log("Server started")
})
