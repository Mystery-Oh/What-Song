const express = require("express");
const router = express.Router();

const songController = require("../controllers/songController");

router.get("/", songController.getSongs);
router.get("/emotion/recommend", songController.getRecommendByEmotion);

router.post("/recommend/text", songController.recommendByText);
router.post("/recommend/coord", songController.recommendByCoord);

//재생기록
router.get("/play-history/user/:userNo", songController.getUserPlayHistory);
router.patch("/play-history/:historyId/end", songController.endPlayHistory);




//좋아요
router.get("/:songId/like", songController.getSongLikeStatus);
router.post("/:songId/like", songController.likeSong);
router.delete("/:songId/like", songController.unlikeSong);
router.get("/likes/user/:userNo", songController.getUserLikedSongs);

router.post("/:songId/play/start", songController.startPlayHistory);


router.get("/:songId/similar", songController.getSimilarSongs);
router.get("/:songId", songController.getSongById);



module.exports = router;