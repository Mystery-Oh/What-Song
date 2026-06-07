import './MyPage.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUserNo } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function MyPage() {
    const navigate = useNavigate();

    const [recentTracks, setRecentTracks] = useState([]);
    const [likedTracks, setLikedTracks] = useState([]);

    useEffect(() => {
        const fetchMyTracks = async () => {
            try {
                const userNo = getCurrentUserNo();

                const [recentRes, likedRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/songs/play-history/user/${userNo}?limit=6`),
                    fetch(`${API_BASE_URL}/api/songs/likes/user/${userNo}?limit=6`),
                ]);

                const recentResult = await recentRes.json();
                const likedResult = await likedRes.json();

                setRecentTracks(recentResult.data || []);
                setLikedTracks(likedResult.data || []);
            } catch (error) {
                console.error('마이페이지 곡 조회 실패:', error);
            }
        };

        fetchMyTracks();
    }, []);


    const handleTrackClick = (track, index, tracks, title) => {
        navigate('/player', {
            state: {
                type: 'playlist',
                keyword: title,
                playlistTitle: title,
                playlist: tracks,
                selectedSong: track,
                selectedIndex: index,
            },
        });
    };


    const renderTrackRow = (tracks, emptyMessage, title) => {
        if (!tracks.length) {
            return <p className="mypage-empty-text">{emptyMessage}</p>;
        }

        return tracks.map((track, index) => (
            <div
                className={`mypage-track-item ${index === 0 ? 'is-active' : ''}`}
                key={`${track.song_id}-${index}`}
                onClick={() => handleTrackClick(track, index, tracks, title)}
            >
                <div className="mypage-track-card">
                    <div className="mypage-track-placeholder">♪</div>
                </div>

                <p className="mypage-track-title">{track.title}</p>
            </div>
        ));
    };

    return (
        <div className="mypage">
            <div className="mypage__container">
                <div className="mypage-top-actions">
                    <button className="mypage-create-btn">
                        <span className="mypage-create-btn__icon">+</span>
                        <span>나만의 플레이 만들기</span>
                    </button>

                    <button
                        className="mypage-home-btn"
                        onClick={() => navigate('/')}
                    >
                        검색 홈
                    </button>
                </div>

                <section className="mypage-section">
                    <div className="mypage-section__header">
                        <h2>최근 들은 곡</h2>

                        <button
                            className="mypage-section__more"
                            onClick={() =>
                                navigate('/track-list', {
                                    state: {
                                        type: 'recent',
                                        title: '최근 들은 곡',
                                    },
                                })
                            }
                        >
                            {'>'}
                        </button>
                    </div>

                    <div className="mypage-track-row">
                        {renderTrackRow(
                            recentTracks,
                            '아직 들은 곡이 없어요.',
                            '최근 들은 곡'
                        )}
                    </div>
                </section>

                <section className="mypage-section">
                    <div className="mypage-section__header">
                        <h2>좋아요 곡</h2>

                        <button
                            className="mypage-section__more"
                            onClick={() =>
                                navigate('/track-list', {
                                    state: {
                                        type: 'liked',
                                        title: '좋아요 곡',
                                    },
                                })
                            }
                        >
                            {'>'}
                        </button>
                    </div>

                    <div className="mypage-track-row">
                        {renderTrackRow(
                            likedTracks,
                            '아직 좋아요한 곡이 없어요.',
                            '좋아요 곡'
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}