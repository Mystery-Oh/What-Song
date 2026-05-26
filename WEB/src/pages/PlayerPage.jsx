import './PlayerPage.css';
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate  } from "react-router-dom";
import EmotionMapModal from "../components/EmotionMapModal";

export default function PlayerPage() {

    const [isSpecOpen, setIsSpecOpen] = useState(false);
    const [isEmotionOpen, setIsEmotionOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [youtubeMap, setYoutubeMap] = useState({});
    const [isPlaying, setIsPlaying] = useState(false);

    const playerRef = useRef(null);
    const playerContainerRef = useRef(null);

    const location = useLocation();
    const navigate = useNavigate();

    const mood = location.state?.mood;
    const keyword = location.state?.keyword || mood?.label || "설렘";
    const playlist = location.state?.playlist || [];

    const getSongId = (song, index) => {
        return song.song_id ?? song.id ?? `${song.title}-${song.artist_name}-${index}`;
    };

    const selectedSong =
        playlist[currentIndex] ||
        location.state?.selectedSong ||
        playlist[0];

    const currentTrack = selectedSong
        ? {
            id: getSongId(selectedSong, currentIndex),
            title: selectedSong.title,
            artist: selectedSong.artist_name,
            image: selectedSong.image || `https://picsum.photos/900/900?${currentIndex}`,
            spectrogramImage: "/spectrograms/spring-in-me.png",
            x: selectedSong.valence * 100,
            y: selectedSong.arousal * 100,
            mood: keyword,
        }
        : {
            id: 999,
            title: "재생할 곡이 없습니다",
            artist: "",
            image: "https://picsum.photos/900/900?10",
            spectrogramImage: "/spectrograms/spring-in-me.png",
            x: 0,
            y: 0,
            mood: keyword,
        };

    useEffect(() => {
        if (!playlist.length) return;

        const fetchTrackThumbnails = async () => {
            const results = {};

            await Promise.all(
                playlist.map(async (song, index) => {
                    try {
                        const id = getSongId(song, index);

                        const params = new URLSearchParams({
                            title: song.title,
                            artist: song.artist_name || "",
                        });

                        const response = await fetch(
                            `${import.meta.env.VITE_API_BASE_URL}/api/youtube/search?${params}`
                        );

                        if (!response.ok) return;

                        const result = await response.json();

                        results[id] = result.data;
                    } catch (error) {
                        console.error("YouTube 썸네일 가져오기 실패:", error);
                    }
                })
            );

            setYoutubeMap(results);
        };

        fetchTrackThumbnails();
    }, [playlist]);

    const currentYoutube = youtubeMap[currentTrack.id];

    const currentImage =
        currentYoutube?.thumbnail ||
        currentTrack.image;

    const currentVideoId = currentYoutube?.videoId;

    const nextTracks = playlist.map((song, index) => {
        const id = getSongId(song, index);
        const youtube = youtubeMap[id];

        return {
            id,
            title: song.title,
            artist: song.artist_name,
            duration: "3:30",
            image:
                youtube?.thumbnail ||
                song.image ||
                `https://picsum.photos/80/80?${index}`,
            active: index === currentIndex,
            x: song.valence * 100,
            y: song.arousal * 100,
            mood: keyword,
            index,
        };
    });

    const handlePlayPause = () => {
        if (!playerRef.current) return;

        if (isPlaying) {
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
    };

    const handleNextTrack = () => {
        if (playlist.length === 0) return;

        setCurrentIndex((prev) => {
            if (prev >= playlist.length - 1) return 0;
            return prev + 1;
        });
    };

    const handlePrevTrack = () => {
        if (playlist.length === 0) return;

        setCurrentIndex((prev) => {
            if (prev <= 0) return playlist.length - 1;
            return prev - 1;
        });
    };

    const handleSelectTrack = (index) => {
        setCurrentIndex(index);
    };

    const emotionPoints = useMemo(() => {
        return nextTracks.map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
            x: track.x,
            y: track.y,
            mood: track.mood,
        }));
    }, [nextTracks]);



    useEffect(() => {
        if (!currentVideoId) return;

        const createPlayer = () => {
            if (playerRef.current) {
                playerRef.current.loadVideoById(currentVideoId);
                setIsPlaying(false);
                return;
            }

            playerRef.current = new window.YT.Player(playerContainerRef.current, {
                width: "300",
                height: "200",
                videoId: currentVideoId,
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    playsinline: 1,
                },
                events: {
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            setIsPlaying(true);
                        }

                        if (
                            event.data === window.YT.PlayerState.PAUSED ||
                            event.data === window.YT.PlayerState.ENDED
                        ) {
                            setIsPlaying(false);
                        }

                        if (event.data === window.YT.PlayerState.ENDED) {
                            handleNextTrack();
                        }
                    },
                },
            });
        };

        if (window.YT && window.YT.Player) {
            createPlayer();
        } else {
            const existingScript = document.querySelector(
                'script[src="https://www.youtube.com/iframe_api"]'
            );

            if (!existingScript) {
                const tag = document.createElement("script");
                tag.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(tag);
            }

            window.onYouTubeIframeAPIReady = createPlayer;
        }
    }, [currentVideoId]);



    return (
        <div className="player-page">
            <div className="player-page__top-actions">
                <button
                    className="player-page__home-btn"
                    onClick={() => navigate(-1)}>
                    뒤로
                </button>
            </div>
            <div className="player-page__container">
                <section className="player-main">
                    <div className="player-main__top-tabs">
                        <button className="is-active">노래</button>
                        <button>동영상</button>
                    </div>

                    <div className="player-main__art-card">
                        <div className="player-main__art-frame">
                            <img
                                src={currentImage}
                                alt={currentTrack.title}
                                className="player-main__art-image"
                            />
                        </div>
                        <div className="player-main__barcode" />
                    </div>
                </section>

                <aside className="player-sidebar">
                    <div className="player-sidebar__header">
                        <h2>다음 트랙</h2>
                    </div>

                    <p className="player-sidebar__source-label">#{keyword} 감정 재생목록</p>
                    <p className="player-sidebar__source-title">{currentTrack.title}</p>

                    {/*<div className="player-sidebar__filters">*/}
                    {/*    <button className="is-active">All</button>*/}
                    {/*    <button>친숙한 곡</button>*/}
                    {/*    <button>처음 듣는 곡</button>*/}
                    {/*    <button>인기</button>*/}
                    {/*    <button>숨은 명곡</button>*/}
                    {/*</div>*/}

                    <div className="player-sidebar__list">
                        {nextTracks.map((track) => (
                            <div
                                className={`track-item ${track.active ? "is-active" : ""}`}
                                key={`${track.id}-${track.title}`}
                                onClick={() => handleSelectTrack(track.index)}
                            >
                                <div className="track-item__cover-wrap">
                                    <img
                                        src={track.image}
                                        alt={track.title}
                                        className="track-item__cover"
                                    />

                                    {track.active && (
                                        <span className="track-item__playing-badge">
                                            재생중
                                        </span>
                                    )}
                                </div>

                                <div className="track-item__meta">
                                    <p className="track-item__title">{track.title}</p>
                                    <p className="track-item__artist">{track.artist}</p>
                                </div>

                                <span className="track-item__duration">{track.duration}</span>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>

            <footer className="bottom-player">
                <div className="bottom-player__left">
                    <button className="icon-btn" onClick={handlePrevTrack}>⏮</button>

                    <button
                        className="icon-btn icon-btn--play"
                        onClick={handlePlayPause}
                    >
                        {isPlaying ? "⏸" : "▶"}
                    </button>

                    <button className="icon-btn" onClick={handleNextTrack}>⏭</button>

                    <span className="bottom-player__time">0:01 / 4:31</span>
                </div>

                <div className="bottom-player__center">
                    <img
                        src={currentImage}
                        alt={currentTrack.title}
                        className="bottom-player__cover"
                    />

                    <div className="bottom-player__info">
                        <p className="bottom-player__title">{currentTrack.title}</p>
                        <p className="bottom-player__artist">{currentTrack.artist}</p>
                    </div>
                </div>

                <div className="bottom-player__right">
                    <button
                        className="player-wave-btn"
                        onClick={() => setIsSpecOpen(true)}
                        aria-label="멜스펙트로그램 보기"
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 100 60"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <rect x="0" y="20" width="6" height="20" rx="3" fill="currentColor" />
                            <rect x="10" y="10" width="6" height="40" rx="3" fill="currentColor" />
                            <rect x="20" y="5" width="6" height="50" rx="3" fill="currentColor" />
                            <rect x="30" y="15" width="6" height="30" rx="3" fill="currentColor" />
                            <rect x="40" y="0" width="6" height="60" rx="3" fill="currentColor" />
                            <rect x="50" y="15" width="6" height="30" rx="3" fill="currentColor" />
                            <rect x="60" y="5" width="6" height="50" rx="3" fill="currentColor" />
                            <rect x="70" y="10" width="6" height="40" rx="3" fill="currentColor" />
                            <rect x="80" y="20" width="6" height="20" rx="3" fill="currentColor" />
                        </svg>
                    </button>

                    <button
                        className="player-emotion-btn"
                        onClick={() => setIsEmotionOpen(true)}
                        aria-label="감정 분포 보기"
                    >
                        감정
                    </button>

                    <button className="icon-btn" aria-label="좋아요">♡</button>
                    <button className="icon-btn" aria-label="볼륨">🔊</button>
                    <button className="icon-btn" aria-label="셔플">🔀</button>
                </div>
            </footer>

            <div className="youtube-hidden-player">
                <div ref={playerContainerRef} />
            </div>

            {isSpecOpen && (
                <div className="spec-modal" onClick={() => setIsSpecOpen(false)}>
                    <div
                        className="spec-modal__panel"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="spec-modal__header">
                            <div>
                                <p className="spec-modal__eyebrow">멜스펙트로그램</p>
                                <h3 className="spec-modal__title">{currentTrack.title}</h3>
                            </div>

                            <button
                                className="spec-modal__close"
                                onClick={() => setIsSpecOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="spec-modal__body">
                            <img
                                src={currentTrack.spectrogramImage}
                                alt={`${currentTrack.title} 멜스펙트로그램`}
                                className="spec-modal__image"
                            />
                        </div>
                    </div>
                </div>
            )}

            <EmotionMapModal
                open={isEmotionOpen}
                onClose={() => setIsEmotionOpen(false)}
                searchedTrack={currentTrack}
                tracks={emotionPoints}
                title="현재 곡 감정 분포"
            />
        </div>
    );
}