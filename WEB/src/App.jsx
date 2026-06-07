import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import SearchResultPage from './pages/SearchResultPage';
import PlayerPage from './pages/PlayerPage';
import MyPage from './pages/MyPage';
import TrackListPage from './pages/TrackListPage';
import LoginPage from "./pages/LoginPage.jsx";
import {useEffect} from "react";

function App() {

    useEffect(() => {
        const checkLogin = async () => {
            const res = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/auth/me`,
                {
                    credentials: "include",
                }
            );

            if (res.ok) {
                const data = await res.json();

                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );
            }
        };

        checkLogin();
    }, []);


    return (
        <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/result" element={<SearchResultPage />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/track-list" element={<TrackListPage />} />
            <Route path="/login" element={<LoginPage />} />
        </Routes>
    );
}

export default App;