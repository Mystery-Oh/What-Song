import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './TrackListPage.css';
import { getCurrentUserNo } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function TrackListPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const pageTitle = location.state?.title || '트랙 목록';
    const type = location.state?.type || 'recent';

    const [tracks, setTracks] = useState([]);

    useEffect(() => {
        const fetchTracks = async () => {
            try {
                const userNo = getCurrentUserNo();

                const url =
                    type === 'liked'
                        ? `${API_BASE_URL}/api/songs/likes/user/${userNo}`
                        : `${API_BASE_URL}/api/songs/play-history/user/${userNo}`;

                const response = await fetch(url);
                const result = await response.json();

                setTracks(result.data || []);
            } catch (error) {
                console.error('트랙 목록 조회 실패:', error);
            }
        };

        fetchTracks();
    }, [type]);

    const formatDuration = (seconds) => {
        if (!seconds) return '--:--';

        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;

        return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const handleTrackClick = (track, index) => {
        navigate('/player', {
            state: {
                type: 'playlist',
                keyword: pageTitle,
                playlistTitle: pageTitle,
                playlist: tracks,
                selectedSong: track,
                selectedIndex: index,
            },
        });
    };

    return (
        <div className="track-list-page">
            <div className="track-list-page__container">
                <h1 className="track-list-page__title">{pageTitle}</h1>

                <div className="track-list">
                    {tracks.map((track, index) => (
                        <div
                            className="track-row"
                            key={`${track.song_id}-${index}`}
                            onClick={() => handleTrackClick(track, index)}
                        >
                            <div className="track-row__cover-placeholder">
                                ♪
                            </div>

                            <div className="track-row__meta">
                                <p className="track-row__title">
                                    {track.title}
                                </p>

                                <p className="track-row__artist">
                                    {track.artist_name || '-'}
                                </p>
                            </div>

                            <span className="track-row__duration">
                                {formatDuration(
                                    track.played_seconds ||
                                    track.duration_seconds
                                )}
                            </span>
                        </div>
                    ))}

                    {tracks.length === 0 && (
                        <p className="track-list__empty">
                            아직 표시할 곡이 없습니다.
                        </p>
                    )}

                    {tracks.length > 0 && (
                        <div className="track-list__load-hint">
                            <div className="track-list__load-dot"></div>
                            <div className="track-list__load-bar"></div>
                            <span>아래로 내려 더 많은 곡 보기</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}