import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage() {
    const navigate = useNavigate();

    const handleKakaoLogin = () => {
        window.location.href = 'http://localhost:4000/api/auth/kakao';
    };

    const handleNaverLogin = () => {
        window.location.href = 'http://localhost:4000/api/auth/naver';
    };

    return (
        <div className="login-page">
            <div className="login-page__container">
                <div className="login-page__top">
                    <button
                        className="login-page__home-btn"
                        onClick={() => navigate('/')}
                    >
                        검색 홈
                    </button>
                </div>

                <main className="login-page__content">
                    <div className="login-page__button-group">
                        <button
                            className="login-page__social-btn login-page__social-btn--kakao"
                            onClick={handleKakaoLogin}
                        >
                            <span className="login-page__icon login-page__icon--kakao">💬</span>
                            <span>카카오로 로그인</span>
                        </button>

                        <button
                            className="login-page__social-btn login-page__social-btn--naver"
                            onClick={handleNaverLogin}
                        >
                            <span className="login-page__icon login-page__icon--naver">N</span>
                            <span>네이버로 로그인</span>
                        </button>
                    </div>
                </main>

            </div>
        </div>
    );
}