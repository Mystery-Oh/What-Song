const express = require("express");
const router = express.Router();

const songController = require("../controllers/songController");

router.get("/", songController.getSongs);
router.get("/emotion/recommend", songController.getRecommendByEmotion);
router.get("/:songId", songController.getSongById);
router.get("/:songId/similar", songController.getSimilarSongs);
router.post("/recommend/text", songController.recommendByText);
router.post("/recommend/coord", songController.recommendByCoord);

module.exports = router;