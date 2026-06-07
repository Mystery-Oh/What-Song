const express = require("express");
const cors = require("cors");
require("dotenv").config();
const session = require("express-session");
const songRoutes = require("./routes/songRoutes");
const authRoutes = require("./routes/authRoutes");
const youtubeRouter = require("./routes/youtubeRouter");

const app = express();

app.use(cors());
app.use(express.json());

//auth session
app.use(session({
    secret: process.env.SESSION_SECRET || "what-song-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
    },
}));

//cors
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));

app.get("/", (req, res) => {
    res.send("What Song API Server Running");
});

app.use("/api/songs", songRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/youtube", youtubeRouter);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});