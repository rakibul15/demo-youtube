import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();    // load environment variables from .env file

const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(express.json({
    limit: "16kb"
}));

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
})