const express = require("express");
const db = require("../config/db");
const bcrypt = require("bcryptjs");


const router = express.Router();

async function findOrCreateSocialMember({ provider, userId, nickname }) {
    const [rows] = await db.execute(
        "SELECT * FROM member WHERE provider = ? AND user_id = ? LIMIT 1",
        [provider, userId]
    );

    if (rows.length > 0) {
        return rows[0];
    }

    const passwordHash = await bcrypt.hash(`${provider}:${userId}`, 10);

    const [result] = await db.execute(
        `INSERT INTO member (user_id, user_pw, nickname, provider, role)
         VALUES (?, ?, ?, ?, 'USER')`,
        [userId, passwordHash, nickname, provider]
    );

    return {
        user_no: result.insertId,
        user_id: userId,
        nickname,
        provider,
        role: "USER",
    };
}

router.get("/kakao", (req, res) => {
    const kakaoAuthUrl = "https://kauth.kakao.com/oauth/authorize";

    const params = new URLSearchParams({
        client_id: process.env.KAKAO_CLIENT_ID,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        response_type: "code",
    });

    res.redirect(`${kakaoAuthUrl}?${params.toString()}`);
});

router.get("/naver", (req, res) => {
    const naverAuthUrl = "https://nid.naver.com/oauth2.0/authorize";

    const params = new URLSearchParams({
        client_id: process.env.NAVER_CLIENT_ID,
        redirect_uri: process.env.NAVER_REDIRECT_URI,
        response_type: "code",
        state: "what-song",
    });

    res.redirect(`${naverAuthUrl}?${params.toString()}`);
});

router.get("/kakao/callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send("카카오 로그인 코드가 없습니다.");
    }

    try {
        const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: process.env.KAKAO_CLIENT_ID,
                redirect_uri: process.env.KAKAO_REDIRECT_URI,
                code,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            console.error("Kakao token response error:", tokenData);
            return res.status(400).send("카카오 토큰을 받지 못했습니다.");
        }

        const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            },
        });

        const kakaoUser = await userResponse.json();

        console.log("Kakao user data:", kakaoUser);

        const member = await findOrCreateSocialMember({
            provider: "kakao",
            userId: String(kakaoUser.id),
            nickname: kakaoUser.properties?.nickname || kakaoUser.kakao_account?.profile?.nickname || "카카오사용자",
        });

        console.log("Logged in member:", member);

        res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/`);
    } catch (error) {
        console.error("Kakao token error:", error);
        res.status(500).send("카카오 토큰 요청 실패");
    }
});

router.get("/naver/callback", async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
        return res.status(400).send("네이버 로그인 코드가 없습니다.");
    }

    try {
        const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: process.env.NAVER_CLIENT_ID,
                client_secret: process.env.NAVER_CLIENT_SECRET,
                code,
                state,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            console.error("Naver token response error:", tokenData);
            return res.status(400).send("네이버 토큰을 받지 못했습니다.");
        }

        const userResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const naverUser = await userResponse.json();

        console.log("Naver user data:", naverUser);

        const member = await findOrCreateSocialMember({
            provider: "naver",
            userId: String(naverUser.response.id),
            nickname: naverUser.response.nickname || naverUser.response.name || "네이버사용자",
        });

        console.log("Logged in member:", member);

        res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/`);
    } catch (error) {
        console.error("Naver token error:", error);
        res.status(500).send("네이버 토큰 요청 실패");
    }
});

module.exports = router;