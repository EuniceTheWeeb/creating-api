// 1. SETUP EXPRESS
require('dotenv').config();
const express = require('express');
const cors = require("cors");
const { ObjectId } = require('mongodb');
const MongoClient = require("mongodb").MongoClient;
const mongoUri = process.env.MONGO_URI;
const dbname = "recipe_book";

// 1a. create the app
const app = express();
app.use(express.json());
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
    // MARK: Get
    app.get('/', function (req, res) {
        res.json({
            "message": "Hello World!"
        });
    })

    // const queryParams = req.query;

    // // Create a response object
    // const response = {
    //     name: queryParams.name,
    //     cuisine: queryParams.cuisine,
    //     tags: queryParams.tags,
    // };

    // // Send the response as JSON
    // res.json(response);

    app.get('/recipes', async (req, res) => {
        try {
            const { tags, cuisine, ingredients, name } = req.query;
            let query = {};
            console.log("Received query parameters:", req.query);

            if (tags) {
                query['tags.name'] = { $in: tags.split(',') };
            }

            if (cuisine) {
                query['cuisine.name'] = { $regex: cuisine, $options: 'i' };
            }

            if (ingredients) {
                query['ingredients.name'] = { $all: ingredients.split(',').map(i => new RegExp(i, 'i')) };
            }

            if (name) {
                query.name = { $regex: name, $options: 'i' };
            }

            const recipes = await db.collection('recipes').find(query).project({
                name: 1,
                'cuisine.name': 1,
                'tags.name': 1,
                _id: 0
            }).toArray();

            res.json({ recipes });
        } catch (error) {
            console.error('Error searching recipes:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // MARK: Post
    app.post('/recipes', async (req, res) => {
        try {
            const { name, cuisine, prepTime, cookTime, servings, ingredients, instructions, tags } = req.body;

            // Basic validation
            if (!name || !cuisine || !ingredients || !instructions || !tags) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Fetch the cuisine document
            const cuisineDoc = await db.collection('cuisines').findOne({ name: cuisine });
            if (!cuisineDoc) {
                return res.status(400).json({ error: 'Invalid cuisine' });
            }

            // Fetch the tag documents
            const tagDocs = await db.collection('tags').find({ name: { $in: tags } }).toArray();
            if (tagDocs.length !== tags.length) {
                return res.status(400).json({ error: 'One or more invalid tags' });
            }

            // Create the new recipe object
            const newRecipe = {
                name,
                cuisine: {
                    _id: cuisineDoc._id,
                    name: cuisineDoc.name
                },
                prepTime,
                cookTime,
                servings,
                ingredients,
                instructions,
                tags: tagDocs.map(tag => ({
                    _id: tag._id,
                    name: tag.name
                }))
            };

            // Insert the new recipe into the database
            const result = await db.collection('recipes').insertOne(newRecipe);

            // Send back the created recipe
            res.status(201).json({
                message: 'Recipe created successfully',
                recipeId: result.insertedId
            });
        } catch (error) {
            console.error('Error creating recipe:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });


    // MARK: Put
    app.put('/recipes/:id', async (req, res) => {
        try {
            const recipeId = req.params.id;
            const { name, cuisine, prepTime, cookTime, servings, ingredients, instructions, tags } = req.body;


            if (!name || !cuisine || !ingredients || !instructions || !tags) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const cuisineDoc = await db.collection('cuisines').findOne({ name: cuisine });
            if (!cuisineDoc) {
                return res.status(400).json({ error: 'Invalid cuisine' });
            }

            const tagDocs = await db.collection('tags').find({ name: { $in: tags } }).toArray();
            if (tagDocs.length !== tags.length) {
                return res.status(400).json({ error: 'One or more invalid tags' });
            }

            // Create the updated recipe object
            const updateRecipe = {
                name,
                cuisine: {
                    _id: cuisineDoc._id,
                    name: cuisineDoc.name
                },
                prepTime,
                cookTime,
                servings,
                ingredients,
                instructions,
                tags: tagDocs.map(tag => ({
                    _id: tag._id,
                    name: tag.name
                }))
            };

            // Insert the updated recipe into the database
            // Client submits an entirely new document to replace the old one, with the same _id
            const result = await db.collection('recipes').updateOne(
                { _id: new ObjectId(recipeId) },
                { $set: updateRecipe }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Recipe not found' });
            }

            res.status(201).json({
                message: 'Recipe updated successfully',
            });
        }
        catch (error) {
            console.error('Error updating recipe:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // MARK: Delete
    
};





main();

// MAKR: 3. START SERVER (Don't put any routes after this line)
app.listen(3000, function () {
    console.log("Server has started");
});