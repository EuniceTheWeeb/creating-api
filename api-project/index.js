// 1. SETUP EXPRESS
const bcrypt = require('bcrypt');
require('dotenv').config();
const express = require('express');
const cors = require("cors");
const { ObjectId } = require('mongodb');
const MongoClient = require("mongodb").MongoClient;
const mongoUri = process.env.MONGO_URI;
const dbname = "recipe_book";

const jwt = require('jsonwebtoken');

const generateAccessToken = (id, email) => {
    return jwt.sign({
        'user_id': id,
        'email': email
    }, process.env.TOKEN_SECRET, {
        expiresIn: "1h"
    });
}

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(403);
    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

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

    // MARK: JWT
    app.post('/users', async function (req, res) {
        // console.log("body >>> ", req.body);
        try {
            const result = await db.collection("users").insertOne({
                "email": req.body.email,
                "password": await bcrypt.hash(req.body.password, 12)
            })
            res.json({
                "message": "New user account",
                "result": result
            })
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    })

    app.post('/login', async (req, res) => {
        try {
            console.log("here >>> ", req.body)
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
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    app.get('/profile', verifyToken, (req, res) => {
        res.json({
            message: 'This is a protected route',
            user: req.user
        });
    });


    // 2. CREATE ROUTES
    // MARK: Get - read recipe database
    app.get('/', function (req, res) {
        res.json({
            "message": "Hello World!"
        });
    })

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

    // MARK: Post - Creating a recipe
    app.post('/recipes', async (req, res) => {
        try {
            const { name, cuisine, prepTime, cookTime, servings, ingredients, instructions, tags } = req.body;

            // Basic validation
            if (!name || !cuisine || !ingredients || !instructions || !tags) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Fetch documents
            const cuisineDoc = await db.collection('cuisines').findOne({ name: cuisine });
            if (!cuisineDoc) {
                return res.status(400).json({ error: 'Invalid cuisine' });
            }
            const tagDocs = await db.collection('tags').find({ name: { $in: tags } }).toArray();
            if (tagDocs.length !== tags.length) {
                return res.status(400).json({ error: 'One or more invalid tags' });
            }

            // Create the new object
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

            // Insert the new object into database
            const result = await db.collection('recipes').insertOne(newRecipe);

            // Send back the created object
            res.status(201).json({
                message: 'Recipe created successfully',
                recipeId: result.insertedId
            });
        } catch (error) {
            console.error('Error creating recipe:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });


    // MARK: Put - update recipe
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

            // Create the updated object
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

            // Insert the updated object into database
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
    app.delete('/recipes/:id', async (req, res) => {
        try {
            const recipeId = req.params.id;

            // Attempt to delete the object
            const result = await db.collection('recipes').deleteOne({ _id: new ObjectId(recipeId) });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Recipe not found' });
            }

            res.json({ message: 'Recipe deleted successfully' });
        } catch (error) {
            console.error('Error deleting recipe:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
};

main();

// MARK: 3. START SERVER (Don't put any routes after this line)
app.listen(3000, function () {
    console.log("Server has started");
});