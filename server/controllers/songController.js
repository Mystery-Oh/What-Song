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

        console.log(result);
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
