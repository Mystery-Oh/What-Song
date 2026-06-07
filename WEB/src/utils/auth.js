// src/utils/auth.js

export const getCurrentUserNo = () => {
    try {
        const user = JSON.parse(
            localStorage.getItem("user")
        );

        if (user?.user_no) {
            return user.user_no;
        }
    } catch (error) {
        console.error(
            "사용자 정보 읽기 실패:",
            error
        );
    }

    return 8; // 개발용 기본 계정
};