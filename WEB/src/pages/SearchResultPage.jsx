import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './SearchResultPage.css';
import EmotionMapModal from "../components/EmotionMapModal";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function SearchResultPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const type = location.state?.type || 'keyword';
    const mood = location.state?.mood || null;
    const keyword = location.state?.keyword || mood?.label || '설렘';

    const [playlists, setPlaylists] = useState([]);
    const [aiMood, setAiMood] = useState(null);
    const [loading, setLoading] = useState(false);

    const [isEmotionOpen, setIsEmotionOpen] = useState(false);

    //복귀용 캐시
    const cacheKey = `search-result:${type}:${keyword}`;


    const today = new Date();
    const formatted = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

    const moods = [
        { label: "설렘", icon: "✨", x: 0.8, y: 0.7 },
        { label: "평온", icon: "≋", x: 0.5, y: -0.8 },
        { label: "우울", icon: "💧", x: -0.7, y: -0.6 },
        { label: "활기찬", icon: "⚡", x: 0.6, y: 0.9 },
        { label: "지침", icon: "☁", x: -0.3, y: -0.9 },
        { label: "편안함", icon: "🛋", x: 0.8, y: -0.5 },
        { label: "기쁨", icon: "☺", x: 0.7, y: 0.5 },
        { label: "긴장됨", icon: "〰", x: -0.6, y: 0.7 },
    ];

    // 감정별 제목 권역 설정
    const createSeed = (tag, coord) => {
        const str = `${tag}-${coord.valence}-${coord.arousal}`;

        let hash = 0;

        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }

        return Math.abs(hash);
    };

    const pickSeeded = (arr = [], seed = 0, offset = 0) => {
        if (!Array.isArray(arr) || arr.length === 0) return "";
        return arr[(seed + offset) % arr.length];
    };


    //권역 별 키워드
    const getCoordMoodWords = (coord) => {
        const valence = Number(coord?.valence ?? 0.5);
        const arousal = Number(coord?.arousal ?? 0.5);

        // 고각성 + 긍정
        if (valence >= 0.65 && arousal >= 0.65) {
            return {
                adjectives: [
                    "짜릿한",
                    "반짝이는",
                    "청량한",
                    "벅차오르는",
                    "생기 있는",
                    "자유로운",
                    "빛나는",
                ],
                nouns: [
                    "리듬",
                    "드라이브",
                    "밤공기",
                    "순간",
                    "질주",
                    "에너지",
                    "파도",
                ],
                scenes: [
                    "심장이 빨라지는 순간",
                    "기분 좋게 달아오르는 리듬",
                    "청량하게 터지는 밤공기",
                    "빛처럼 번지는 에너지",
                    "한껏 벅차오르는 드라이브",
                ],
            };
        }

        // 저각성 + 긍정
        if (valence >= 0.65 && arousal < 0.65) {
            return {
                adjectives: [
                    "포근한",
                    "따뜻한",
                    "잔잔한",
                    "몽글한",
                    "여유로운",
                    "편안한",
                    "부드러운",
                ],
                nouns: [
                    "새벽",
                    "산책",
                    "공기",
                    "감정선",
                    "햇살",
                    "카페",
                    "밤",
                ],
                scenes: [
                    "천천히 스며드는 밤",
                    "조용히 걷고 싶은 거리",
                    "햇살처럼 머무는 순간",
                    "편안하게 이어지는 산책",
                    "마음이 부드러워지는 시간",
                ],
            };
        }

        // 고각성 + 부정
        if (valence < 0.65 && arousal >= 0.65) {
            return {
                adjectives: [
                    "강렬한",
                    "날카로운",
                    "긴장감 있는",
                    "몰입되는",
                    "흔들리는",
                    "압도적인",
                    "선명한",
                ],
                nouns: [
                    "심야",
                    "도시",
                    "장면",
                    "폭풍",
                    "감정",
                    "야경",
                    "리듬",
                ],
                scenes: [
                    "긴장감이 차오르는 장면",
                    "도시의 밤처럼 선명한 리듬",
                    "감정이 흔들리는 순간",
                    "강하게 몰입되는 심야",
                    "불안하게 빛나는 야경",
                ],
            };
        }

        // 저각성 + 부정
        return {
            adjectives: [
                "공허한",
                "흐릿한",
                "쓸쓸한",
                "가라앉는",
                "먹먹한",
                "잔향이 남는",
                "조용한",
            ],
            nouns: [
                "새벽",
                "여운",
                "밤공기",
                "골목",
                "회상",
                "감정선",
                "잔상",
            ],
            scenes: [
                "새벽처럼 가라앉는 마음",
                "잔향이 오래 남는 밤",
                "조용히 스쳐 가는 회상",
                "비 오는 밤의 여운",
                "흐릿하게 남은 감정선",
            ],
        };
    };

    // 제목 생성 함수
    const generatePlaylistTitle = (tag, coord) => {
        const seed = createSeed(tag, coord);
        const { adjectives, nouns, scenes } = getCoordMoodWords(coord);

        const patterns = [
            () => `${pickSeeded(adjectives, seed, 1)} ${pickSeeded(nouns, seed, 2)}`,
            () => pickSeeded(scenes, seed, 3),
            () => `${tag}이 번지는 ${pickSeeded(nouns, seed, 4)}`,
            () => `${pickSeeded(adjectives, seed, 5)} 분위기`,
            () => `${pickSeeded(nouns, seed, 6)}에 가까운 ${tag}`,
        ];

        return patterns[seed % patterns.length]();
    };

    //description 생성 함수
    const generatePlaylistDescription = (tag, coord) => {
        const seed = createSeed(tag, coord);
        const { adjectives, nouns } = getCoordMoodWords(coord);

        const templates = [
            () => `${pickSeeded(adjectives, seed, 1)} 분위기의 음악들을 담았어요.`,
            () => `${pickSeeded(nouns, seed, 2)}처럼 자연스럽게 이어지는 곡들이에요.`,
            () => `${tag}의 감정선을 부드럽게 따라가는 플레이리스트예요.`,
            () => `지금 분위기에 부담 없이 어울리는 곡들을 모았어요.`,
            () => `${pickSeeded(adjectives, seed, 3)} 감정을 오래 느낄 수 있어요.`,
            () => `${tag}에 가까운 결의 음악들을 골랐어요.`,
        ];

        return templates[seed % templates.length]();
    };


    // const fetchPlaylistByCoord = async (tagItem, index, searchKeyword) => {
    const fetchPlaylistByCoord = async (tagItem, index, usedSongIds) => {
        const res = await fetch(`${API_BASE_URL}/api/songs/recommend/coord`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                valence: tagItem.coord.valence,
                arousal: tagItem.coord.arousal,
                limit: 20,
            }),
        });

        const result = await res.json();

        const rawSongs = result.success ? result.data : [];

        const songs = rawSongs
            .filter((song) => {
                const songKey = song.song_id ?? `${song.title}-${song.artist_name}`;
                return !usedSongIds.has(songKey);
            })
            .slice(0, 5);

        songs.forEach((song) => {
            const songKey = song.song_id ?? `${song.title}-${song.artist_name}`;
            usedSongIds.add(songKey);
        });

        return {
            playlistId: `tag-${index}`,
            title: tagItem.isBaseMood
                ? "지금 감정에 가장 가까운 곡"
                : generatePlaylistTitle(tagItem.tags, tagItem.coord),

            description: tagItem.isBaseMood
                ? "AI가 분석한 현재 감정 좌표와 가까운 곡들이에요."
                : generatePlaylistDescription(tagItem.tags, tagItem.coord),

            songs,
            coverSong: songs[0],
            tag: tagItem.tags,
            coord: tagItem.coord,
        };
    };

    const fetchAiRecommend = async (query) => {
        try {
            setLoading(true);

            const cached = sessionStorage.getItem(cacheKey);

            if (cached) {
                const parsed = JSON.parse(cached);

                setAiMood(parsed.aiMood);
                setPlaylists(parsed.playlists);
                setLoading(false);
                return;
            }


            const res = await fetch(`${API_BASE_URL}/api/songs/recommend/text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    limit: 20,
                }),
            });

            const result = await res.json();

            if (!result.success) {
                setPlaylists([]);
                return;
            }

            setAiMood(result.mood);

            const baseMoodCoord = {
                tags: keyword,
                coord: {
                    valence: result.mood.valence,
                    arousal: result.mood.arousal,
                },
                isBaseMood: true,
            };

            const tagCoords = [
                baseMoodCoord,
                ...(result.mood?.tags_coord || []),
            ];

            if (!tagCoords.length) {
                setPlaylists([]);
                return;
            }

            const usedSongIds = new Set();
            const createdPlaylists = [];

            for (const [index, tagItem] of tagCoords.entries()) {
                const playlist = await fetchPlaylistByCoord(
                    tagItem,
                    index,
                    usedSongIds
                );

                if (playlist.coverSong) {
                    createdPlaylists.push(playlist);
                }
            }

            //저장용 캐시 추가
            sessionStorage.setItem(
                cacheKey,
                JSON.stringify({
                    aiMood: result.mood,
                    playlists: createdPlaylists,
                })
            );

            setPlaylists(createdPlaylists);

            setPlaylists(
                createdPlaylists.filter((playlist) => playlist.coverSong)
            );

        } catch (error) {
            console.error('AI 추천 조회 실패:', error);
            setPlaylists([]);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        if (type === 'keyword') {
            fetchAiRecommend(keyword);
        }

        if (type === 'mood' && mood) {
            fetchAiRecommend(mood.label);
        }
    }, [type, keyword, mood]);


    const topPlaylists = playlists.slice(0, 2);
    const bottomPlaylists = playlists.slice(2, 6);

    const emotionPoints = useMemo(() => {
        const songMap = new Map();

        playlists
            .flatMap((playlist) => playlist.songs || [])
            .forEach((song, index) => {
                const key = song.song_id ?? `${song.title}-${song.artist_name}`;

                if (!songMap.has(key)) {
                    songMap.set(key, {
                        id: key,
                        title: song.title,
                        artist: song.artist_name,
                        x: Number(song.valence) * 100,
                        y: Number(song.arousal) * 100,
                        mood: keyword,
                    });
                }
            });

        return Array.from(songMap.values());
    }, [playlists, keyword]);

    const searchedTrack = {
        title: keyword,
        artist: "AI 감정 분석",
        x: Number(aiMood?.valence || 0) * 100,
        y: Number(aiMood?.arousal || 0) * 100,
        mood: keyword,
    };


    const goToResultByMood = (selectedMood) => {
        navigate('/result', {
            replace: true,
            state: {
                type: 'mood',
                mood: selectedMood,
            },
        });
    };

    const buildMoodKeywords = (mood) => {
        const tags = mood?.search_tags || [];

        if (!tags.length) {
            return "#감성";
        }

        return `#${tags[0]}`;
    };


    const PlaylistSkeletonCard = ({ large = false }) => {
        return (
            <div className={`playlist-skeleton-card ${large ? "large" : ""}`}>
                <div className={`playlist-skeleton-image ${large ? "large" : ""}`} />
                <div className="playlist-skeleton-title" />
                <div className="playlist-skeleton-desc" />
            </div>
        );
    };



    return (
        <div className="result-page">
            <div className="result-container">
                <header className="result-header">
                    <div className="header-left">
                        <span>#{keyword}_리스트</span>
                        <span>Date: {formatted}</span>
                        <span>Page: 1</span>
                    </div>

                    <div className="header-right">
                        <button onClick={() => navigate('/')}>검색 홈</button>
                        <button className="outline" onClick={() => navigate('/login')}>로그인</button>
                    </div>
                </header>

                <div className="result-title-row">
                    <h1 className="result-title">
                        {loading ? (
                            <div className="result-title-skeleton-wrap">
                                <div className="result-title-skeleton result-title-skeleton--main" />
                                <div className="result-title-skeleton result-title-skeleton--keyword" />
                            </div>
                        ) : (
                            <>
                                당신의 기분은{" "}
                                <span>{buildMoodKeywords(aiMood)}!</span>
                            </>
                        )}
                    </h1>

                    <button
                        className="result-emotion-btn"
                        onClick={() => setIsEmotionOpen(true)}
                    >
                        감정 분석
                    </button>
                </div>

                {aiMood?.reason && (
                    <p className="result-description">
                        {aiMood.reason}
                    </p>
                )}

                <div className="result-main">
                    <div className="result-cards">
                        {loading ? (
                            <>
                                <PlaylistSkeletonCard large />
                                <PlaylistSkeletonCard large />
                            </>
                        ) : (
                            topPlaylists.map((playlist) => (
                                <div className="card large" key={playlist.playlistId}>
                                    <div className="album-stack album-stack--large">
                                        <span className="album-stack__layer album-stack__layer--1"></span>
                                        <span className="album-stack__layer album-stack__layer--2"></span>

                                        <img
                                            src={`https://picsum.photos/420/420?${encodeURIComponent(playlist.title)}`}
                                            alt={playlist.title}
                                            className="album-stack__image"
                                            onClick={() =>
                                                navigate('/player', {
                                                    state: {
                                                        type: 'playlist',
                                                        keyword,
                                                        mood: aiMood || mood,
                                                        playlistTitle: playlist.title,
                                                        playlist: playlist.songs,
                                                        selectedSong: playlist.coverSong,
                                                    },
                                                })
                                            }
                                        />
                                    </div>

                                    <p className="title">{playlist.title}</p>
                                    <p className="artist">{playlist.description}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="result-tags">
                        {moods.map((item) => (
                            <button
                                key={item.label}
                                className={keyword === item.label ? 'active' : ''}
                                onClick={() => goToResultByMood(item)}
                            >
                                <span className="result-tags__icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <section className="result-section">
                    <h2>추천 재생목록</h2>

                    {loading ? (
                        <div className="small-cards">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <PlaylistSkeletonCard key={index} />
                            ))}
                        </div>
                    ) : (
                        <div className="small-cards">
                            {bottomPlaylists.map((playlist) => (
                                <div className="card small" key={`small-${playlist.playlistId}`}>
                                    <div className="album-stack album-stack--small">
                                        <span className="album-stack__layer album-stack__layer--2"></span>

                                        <img
                                            src={`https://picsum.photos/300/300?${encodeURIComponent(playlist.title)}`}
                                            alt={playlist.title}
                                            className="album-stack__image"
                                            onClick={() =>
                                                navigate('/player', {
                                                    state: {
                                                        type: 'playlist',
                                                        keyword,
                                                        mood: aiMood || mood,
                                                        playlistTitle: playlist.title,
                                                        playlist: playlist.songs,
                                                        selectedSong: playlist.coverSong,
                                                    },
                                                })
                                            }
                                        />
                                    </div>

                                    <p className="title">{playlist.title}</p>
                                    <p className="artist">{playlist.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <footer className="result-footer">
                    <a href="#">ABOUT</a>
                    <span>|</span>
                    <a href="/mypage">MY MOOD LOG</a>
                    <span>|</span>
                </footer>
            </div>

            <EmotionMapModal
                open={isEmotionOpen}
                onClose={() => setIsEmotionOpen(false)}
                searchedTrack={searchedTrack}
                tracks={emotionPoints}
                title={`${keyword} 추천곡 감정 분포`}
            />


        </div>
    );
}