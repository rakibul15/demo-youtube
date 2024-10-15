import dotenv from "dotenv";
import connectDB from "./db/index.js";
import express from "express";

const app = express();

// Load environment variables from .env file
dotenv.config({
    path: "./.env",  // Corrected the path to .env
});

// Connect to MongoDB
connectDB()
    .then(() => {
        // Start the server after a successful connection
        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running on port ${process.env.PORT || 8000}`);
        });
    })
    .catch((err) => {
        // Log error if connection to MongoDB fails
        console.error("MongoDB connection error: ", err);
    });



//
// import express from "express"
// const app = express()
//
// ;(async () => {
//     try {
//         const conn = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
//         app.on("error", (error) => {
//             console.log(error)
//             throw error
//         })
//         app.listen(process.env.PORT, () => {
//             console.log(`Listening on port ${process.env.PORT}`)
//         })
//     } catch (error) {
//         console.log(error)
//         throw error
//     }
// })()