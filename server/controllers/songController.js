const db = require("../config/db");

// 전체 곡 목록
exports.getSongs = async (req, res) => {
    try {
        const sql = `
      SELECT
        s.song_id,
        s.title,
        s.artist_id,
        a.artist_name,
        ST_X(s.russell_pt) AS valence,
        ST_Y(s.russell_pt) AS arousal,
        s.root_note,
        s.scale
      FROM songs_pop s
      LEFT JOIN artists a ON s.artist_id = a.artist_id
      ORDER BY s.song_id ASC
    `;

        const [rows] = await db.execute(sql);

        res.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "곡 목록 조회 실패",
        });
    }
};

// 특정 곡 상세
exports.getSongById = async (req, res) => {
    try {
        const { songId } = req.params;

        const sql = `
      SELECT
        s.song_id,
        s.title,
        s.artist_id,
        a.artist_name,
        ST_X(s.russell_pt) AS valence,
        ST_Y(s.russell_pt) AS arousal,
        s.root_note,
        s.scale
      FROM songs_pop s
      LEFT JOIN artists a ON s.artist_id = a.artist_id
      WHERE s.song_id = ?
    `;

        const [rows] = await db.execute(sql, [songId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "곡을 찾을 수 없습니다.",
            });
        }

        res.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "곡 상세 조회 실패",
        });
    }
};

// 특정 곡 기준 유사곡 추천
exports.getSimilarSongs = async (req, res) => {
    try {
        const { songId } = req.params;
        const limit = Number(req.query.limit) || 10;

        const sql = `
      SELECT
        s.song_id,
        s.title,
        s.artist_id,
        a.artist_name,
        ST_X(s.russell_pt) AS valence,
        ST_Y(s.russell_pt) AS arousal,
        s.root_note,
        s.scale,
        ST_Distance(
          s.russell_pt,
          (SELECT russell_pt FROM songs WHERE song_id = ?)
        ) AS dist
      FROM songs_pop s
      LEFT JOIN artists a ON s.artist_id = a.artist_id
      WHERE s.song_id != ?
      ORDER BY dist ASC
      LIMIT ?
    `;

        const [rows] = await db.execute(sql, [songId, songId, limit]);

        res.json({
            success: true,
            base_song_id: Number(songId),
            data: rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "유사곡 추천 실패",
        });
    }
};

// 감정 좌표 기반 추천
//활기찬 (0.6, 0.9)
// 설렘 (0.8, 0.7)
// 기쁨 (0.7, 0.5)
// 긴장된 (-0.6, 0.7)
// 우울 (-0.7, -0.6)
// 지침 (-0.3, -0.9)
// 평온 (0.5, -0.8)
// 편안함 (0.8, -0.5

// 05.12 메모 _ 테이블 songs_pop으로 변경 하기
exports.getRecommendByEmotion = async (req, res) => {
    try {
        const x = Number(req.query.x);
        const y = Number(req.query.y);
        const limit = Number(req.query.limit) || 10;

        if (Number.isNaN(x) || Number.isNaN(y)) {
            return res.status(400).json({
                success: false,
                message: "x, y 감정 좌표가 필요합니다.",
            });
        }

        const sql = `
      SELECT
        s.song_id,
        s.title,
        s.artist_id,
        a.artist_name,
        ST_X(s.russell_pt) AS valence,
        ST_Y(s.russell_pt) AS arousal,
        s.root_note,
        s.scale,
        ST_Distance(s.russell_pt, POINT(?, ?)) AS dist
      FROM songs_pop s
      LEFT JOIN artists a ON s.artist_id = a.artist_id
      ORDER BY dist ASC
                    
      LIMIT ?
    `;

        const [rows] = await db.execute(sql, [x, y, limit]);

        res.json({
            success: true,
            emotion: {
                valence: x,
                arousal: y,
            },
            data: rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "감정 기반 추천 실패",
        });
    }

};

// GPT 검색 결과
exports.recommendByText = async (req, res) => {
    try {
        const { query, limit = 10 } = req.body;

        const response = await fetch("https://what-song.onrender.com/recommend", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-password": process.env.API_PASSWORD,
            },
            body: JSON.stringify({
                query,
                limit,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => null);
            return res.status(response.status).json({
                success: false,
                error,
            });
        }

        const result = await response.json();

        // console.log(result);
        // console.log(result.mood.tags_coord);

        res.json({
            success: true,
            query: result.query,
            mood: result.mood,
            data: result.songs || [],
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "AI 추천 서버 호출 실패",
        });
    }
};

//GPT 결과로 Tags 좌표 기반 재생목록
// 태그 좌표 기반 재생목록 추천
exports.recommendByCoord = async (req, res) => {
    try {
        const { valence, arousal, limit = 15 } = req.body;

        const x = Number(valence);
        const y = Number(arousal);
        const safeLimit = Number(limit) || 5;

        if (Number.isNaN(x) || Number.isNaN(y)) {
            return res.status(400).json({
                success: false,
                message: "valence, arousal 감정 좌표가 필요합니다.",
            });
        }

        const sql = `
            SELECT
                s.song_id,
                s.title,
                s.artist_id,
                a.artist_name,
                ST_X(s.russell_pt) AS valence,
                ST_Y(s.russell_pt) AS arousal,
                s.root_note,
                s.scale,
                ST_Distance(s.russell_pt, POINT(?, ?)) AS distance
            FROM songs_pop s
            LEFT JOIN artists a ON s.artist_id = a.artist_id
            WHERE s.russell_pt IS NOT NULL
            ORDER BY distance ASC
            LIMIT ?
        `;

        const [rows] = await db.execute(sql, [x, y, safeLimit]);

        res.json({
            success: true,
            coord: {
                valence: x,
                arousal: y,
            },
            data: rows,
        });
    } catch (error) {
        console.error("좌표 기반 재생목록 추천 실패:", error);

        res.status(500).json({
            success: false,
            message: "좌표 기반 재생목록 추천 실패",
        });
    }
};

//좋아요기능
// 좋아요 여부 조회
exports.getSongLikeStatus = async (req, res) => {
    try {
        const { songId } = req.params;
        const userNo = Number(req.query.user_no);

        if (!userNo || !songId) {
            return res.status(400).json({
                success: false,
                message: "user_no와 song_id가 필요합니다.",
            });
        }

        const sql = `
            SELECT COUNT(*) AS count
            FROM song_like
            WHERE user_no = ?
              AND song_id = ?
        `;

        const [rows] = await db.execute(sql, [userNo, songId]);

        res.json({
            success: true,
            liked: rows[0].count > 0,
        });
    } catch (error) {
        console.error("좋아요 상태 조회 실패:", error);
        res.status(500).json({
            success: false,
            message: "좋아요 상태 조회 실패",
        });
    }
};

// 좋아요 추가
exports.likeSong = async (req, res) => {
    try {
        const { songId } = req.params;
        const userNo = Number(req.body.user_no);

        if (!userNo || !songId) {
            return res.status(400).json({
                success: false,
                message: "user_no와 song_id가 필요합니다.",
            });
        }

        const sql = `
            INSERT IGNORE INTO song_like (user_no, song_id)
            VALUES (?, ?)
        `;

        await db.execute(sql, [userNo, songId]);

        res.json({
            success: true,
            liked: true,
        });
    } catch (error) {
        console.error("좋아요 등록 실패:", error);
        res.status(500).json({
            success: false,
            message: "좋아요 등록 실패",
        });
    }
};

// 좋아요 취소
exports.unlikeSong = async (req, res) => {
    try {
        const { songId } = req.params;
        const userNo = Number(req.body.user_no);

        if (!userNo || !songId) {
            return res.status(400).json({
                success: false,
                message: "user_no와 song_id가 필요합니다.",
            });
        }

        const sql = `
            DELETE FROM song_like
            WHERE user_no = ?
              AND song_id = ?
        `;

        await db.execute(sql, [userNo, songId]);

        res.json({
            success: true,
            liked: false,
        });
    } catch (error) {
        console.error("좋아요 취소 실패:", error);
        res.status(500).json({
            success: false,
            message: "좋아요 취소 실패",
        });
    }
};

// 재생 시작 기록
exports.startPlayHistory = async (req, res) => {
    try {
        const { songId } = req.params;
        const userNo = Number(req.body.user_no);
        const durationSeconds = req.body.duration_seconds
            ? Number(req.body.duration_seconds)
            : null;

        if (!userNo || !songId) {
            return res.status(400).json({
                success: false,
                message: "user_no와 song_id가 필요합니다.",
            });
        }

        const sql = `
            INSERT INTO user_song_play_history (
                user_no,
                song_id,
                duration_seconds,
                started_at
            )
            VALUES (?, ?, ?, NOW())
        `;

        const [result] = await db.execute(sql, [
            userNo,
            Number(songId),
            durationSeconds,
        ]);

        res.json({
            success: true,
            history_id: result.insertId,
        });
    } catch (error) {
        console.error("재생 시작 기록 실패:", error);

        res.status(500).json({
            success: false,
            message: "재생 시작 기록 실패",
            error: error.message,
        });
    }
};

// 재생 종료 기록
exports.endPlayHistory = async (req, res) => {
    try {
        const { historyId } = req.params;
        const playedSeconds = Number(req.body.played_seconds) || 0;
        const durationSeconds = req.body.duration_seconds
            ? Number(req.body.duration_seconds)
            : null;

        if (!historyId) {
            return res.status(400).json({
                success: false,
                message: "history_id가 필요합니다.",
            });
        }

        const sql = `
            UPDATE user_song_play_history
            SET
                played_seconds = ?,
                duration_seconds = COALESCE(?, duration_seconds),
                ended_at = NOW()
            WHERE history_id = ?
        `;

        await db.execute(sql, [
            playedSeconds,
            durationSeconds,
            Number(historyId),
        ]);

        res.json({
            success: true,
        });
    } catch (error) {
        console.error("재생 종료 기록 실패:", error);

        res.status(500).json({
            success: false,
            message: "재생 종료 기록 실패",
            error: error.message,
        });
    }
};

// 사용자 재생 기록 조회
exports.getUserPlayHistory = async (req, res) => {
    try {
        const { userNo } = req.params;
        const limit = Number(req.query.limit) || 30;

        if (!userNo) {
            return res.status(400).json({
                success: false,
                message: "user_no가 필요합니다.",
            });
        }

        const sql = `
            SELECT
                h.history_id,
                h.user_no,
                h.song_id,
                h.played_seconds,
                h.duration_seconds,
                h.started_at,
                h.ended_at,
                s.title,
                a.artist_name,
                ST_X(s.russell_pt) AS valence,
                ST_Y(s.russell_pt) AS arousal
            FROM user_song_play_history h
            LEFT JOIN songs_pop s ON h.song_id = s.song_id
            LEFT JOIN artists a ON s.artist_id = a.artist_id
            WHERE h.user_no = ?
            ORDER BY h.started_at DESC
            LIMIT ?
        `;

        const [rows] = await db.execute(sql, [
            Number(userNo),
            limit,
        ]);

        res.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("사용자 재생 기록 조회 실패:", error);

        res.status(500).json({
            success: false,
            message: "사용자 재생 기록 조회 실패",
            error: error.message,
        });
    }
};

//좋아요곡 조회
exports.getUserLikedSongs = async (req, res) => {
    try {
        const { userNo } = req.params;
        const limit = Number(req.query.limit) || 6;

        const sql = `
            SELECT
                sl.like_id,
                sl.user_no,
                sl.song_id,
                sl.create_at,
                s.title,
                a.artist_name,
                ST_X(s.russell_pt) AS valence,
                ST_Y(s.russell_pt) AS arousal
            FROM song_like sl
            JOIN songs_pop s
              ON sl.song_id = s.song_id
            LEFT JOIN artists a
              ON s.artist_id = a.artist_id
            WHERE sl.user_no = ?
            ORDER BY sl.create_at DESC
            LIMIT ?
        `;

        const [rows] = await db.execute(sql, [
            Number(userNo),
            limit,
        ]);

        res.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("좋아요 곡 목록 조회 실패:", error);
        res.status(500).json({
            success: false,
            message: "좋아요 곡 목록 조회 실패",
            error: error.message,
        });
    }
};