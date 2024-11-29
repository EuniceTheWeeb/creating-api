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

// MARK: Always last code of RESTFul API
app.listen(3000, ()=>{
    console.log("Server started")
})
