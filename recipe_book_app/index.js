// 1. SETUP EXPRESS
const express = require('express');
const cors = require("cors");
require('dotenv').config();
const MongoClient = require("mongodb").MongoClient;
const mongoUri = process.env.MONGO_URI;
const dbname = "recipe_book"; // CHANGE THIS TO YOUR ACTUAL DATABASE NAME

// 1a. create the app
const app = express();

// !! Enable processing JSON data
app.use(express.json());

// !! Enable CORS
app.use(cors());

async function connect(uri, dbname) {
    let client = await MongoClient.connect(uri, {
        useUnifiedTopology: true
    })
    let _db = client.db(dbname);
    return _db;
}

async function main() {
    let db = await connect(mongoUri, dbname);

    // 2. CREATE ROUTES
    app.get('/', function (req, res) {
        res.json({
            "message": "Hello World!"
        });
    })

    app.get("/recipes", async (req, res) => {
        try {
            const recipes = await db.collection("recipes").find().project({
                name: 1,
                cuisine: 1,
                tags: 1,
                prepTime: 1,
            }).toArray();
            
            res.json({ recipes });
        } catch (error) {
            console.error("Error fetching recipes:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
}

main();

// 3. START SERVER (Don't put any routes after this line)
app.listen(3000, function () {
    console.log("Server has started");
})

