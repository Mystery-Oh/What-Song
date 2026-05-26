const express = require("express");
const cors = require("cors");
require("dotenv").config();

const songRoutes = require("./routes/songRoutes");
const authRoutes = require("./routes/authRoutes");
const youtubeRouter = require("./routes/youtubeRouter");

const app = express();

app.use(cors());
app.use(express.json());

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