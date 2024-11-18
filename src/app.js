import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
// routes Import
import userRoutes from "./routes/user.routes.js";
import videoRoutes from "./routes/video.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";

dotenv.config();    // load environment variables from .env file

const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(express.json({
    limit: "16kb"
}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"));

app.use(cookieParser());

// routes declaration
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/video", videoRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);


export {app}

// app.listen(process.env.PORT, () => {
//     console.log(`Server is running on port ${process.env.PORT}`);
// })