const express = require("express");

const router = express.Router();

const {
    searchYoutube,
} = require("../controllers/youtubeController");

router.get("/search", searchYoutube);

module.exports = router;