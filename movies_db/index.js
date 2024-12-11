// 1. SETUP EXPRESS
const bcrypt = require('bcrypt');
require('dotenv').config();
const express = require('express');
const cors = require("cors");
const { ObjectId } = require('mongodb');
const MongoClient = require("mongodb").MongoClient;
const mongoUri = process.env.MONGO_URI;
const dbname = "movies_db";

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
    try {
        let client = await MongoClient.connect(uri, {
            useUnifiedTopology: true
        })
        let _db = client.db(dbname);
        return _db;
    } catch (error) {
        console.error("Failed to connect to MongoDB: ", error)
    }
}

async function main() {
    let db = await connect(mongoUri, dbname);

    // MARK: JWT
    app.post('/users', async function (req, res) {
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
    // MARK: Get - read movie database
    app.get('/', function (req, res) {
        res.json({
            "message": "Hello World!"
        });
    })

    app.get('/movies', async (req, res) => {
        try {
            const { title, cast, runningTime, releaseDate, plotSummary, reviews, genres } = req.query;
            let query = {};

            if (title) {
                query.title = { $regex: title, $options: 'i' };
            }
            if (cast) {
                query['cast'] = { $all: cast.split(',').map(i => new RegExp(i, 'i')) };
            }
            if (runningTime) {
                query.runningTime = { $regex: runningTime, $options: 'i' };
            }
            if (releaseDate) {
                query.runningTime = { $regex: releaseDate, $options: 'i' };
            }
            if (plotSummary) {
                query['plotSummary.name'] = { $regex: plotSummary, $options: 'i' };
            }
            if (reviews) {
                query['reviews'] = { $all: reviews.split(',').map(i => new RegExp(i, 'i')) };
            }
            if (genres) {
                query['genres._id'] = { $in: genres.split(',').map(id => new ObjectId(id)) };
            }

            const movies = await db.collection('movies').find(query).project({
                title: 1,
                cast: 1,
                runningTime: 1,
                releaseDate: 1,
                plotSummary: 1,
                reviews: 1,
                'genres.name': 1,
                _id: 0
            }).toArray();

            res.json({ movies });
        } catch (error) {
            console.error('Error searching movies:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Post - Creating a movie record
    app.post('/movies', async (req, res) => {
        try {
            const { title, cast, runningTime, releaseDate, plotSummary, reviews, genres } = req.body;

            if (!title || !cast || !runningTime || !releaseDate || !plotSummary || !reviews || !genres) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const genreDocs = await db.collection('genres').find({ name: { $in: genres } }).toArray();
            if (genreDocs.length !== genres.length) {
                return res.status(400).json({ error: 'One or more invalid genres' });
            }
    
            const newMovie = {
                title,
                cast: {
                    productionCompany: cast.productionCompany,
                    directedBy: cast.directedBy,
                    starring: cast.starring
                },
                runningTime,
                releaseDate,
                plotSummary,
                reviews: {
                    RottenTomatoes: reviews.RottenTomatoes,
                    Metacritic: reviews.Metacritic,
                    CinemaScore: reviews.CinemaScore
                },
                genres: genreDocs.map(genre => ({
                    _id: genre._id,
                    name: genre.name
                }))
            };
    
            const result = await db.collection('movies').insertOne(newMovie);
    
            res.status(201).json({
                message: 'Movie created successfully',
                movieId: result.insertedId
            });
        } catch (error) {
            console.error('Error creating movie:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    

    // MARK: Put - update movie record
    app.put('/movies/:id', async (req, res) => {
        try {
            const movieId = req.params.id;
            const { title, cast, runningTime, releaseDate, plotSummary, reviews, genres } = req.body;
    
            if (!title || !cast || !runningTime || !releaseDate || !plotSummary || !reviews || !genres) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
    
            const genreDocs = await db.collection('genres').find({ name: { $in: genres } }).toArray();
            if (genreDocs.length !== genres.length) {
                return res.status(400).json({ error: 'One or more invalid genres' });
            }
    
            const updatedMovie = {
                title,
                cast: {
                    productionCompany: cast.productionCompany,
                    directedBy: cast.directedBy,
                    starring: cast.starring
                },
                runningTime,
                releaseDate,
                plotSummary,
                reviews: {
                    RottenTomatoes: reviews.RottenTomatoes,
                    Metacritic: reviews.Metacritic,
                    CinemaScore: reviews.CinemaScore
                },
                genres: genreDocs.map(genre => ({
                    _id: genre._id,
                    name: genre.name
                }))
            };
    
            const result = await db.collection('movies').updateOne(
                { _id: new ObjectId(movieId) },
                { $set: updatedMovie }
            );
    
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Movie not found' });
            }
            if (result.modifiedCount === 0) {
                return res.status(400).json({ error: 'Movie not modified' });
            }
    
            res.status(200).json({
                message: 'Movie updated successfully',
            });
        } catch (error) {
            console.error('Error updating movie:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    

    // MARK: Delete
    app.delete('/movies/:id', async (req, res) => {
        try {
            const movieId = req.params.id;

            // Attempt to delete the object
            const result = await db.collection('movies').deleteOne({ _id: new ObjectId(movieId) });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Movie not found' });
            }

            res.json({ message: 'Movie deleted successfully' });
        } catch (error) {
            console.error('Error deleting movie:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
};

main();

// MARK: 3. START SERVER (Don't put any routes after this line)
app.listen(3000, function () {
    console.log("Server has started");
});