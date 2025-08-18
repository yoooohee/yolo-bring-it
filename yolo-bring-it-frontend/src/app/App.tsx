// import { motion, AnimatePresence } from "framer-motion";
// import { LoginForm } from "@/pages/LoginForm";
// import { RegisterForm } from "@/pages/RegisterForm";
// import { ForgotPasswordForm } from "@/pages/ForgotPasswordForm";
// import { LobbyScreen } from "@/pages/LobbyScreen";
// import { GameJoinScreen } from "@/pages/GameJoinScreen";
// import { GameWaitingRoom } from "@/pages/GameWaitingRoom";
// import { GameScreen } from "@/pages/GameScreen";
// import { RoundResultScreen } from "@/pages/RoundResultScreen";
// import { FinalResultScreen } from "@/pages/FinalResultScreen";
// import { LandingPage } from "@/pages/LandingPage";
// import { ThemeProvider } from "@/shared/lib/ThemeContext";
// import { useGameLogic } from "@/shared/hooks/useGameLogic";
// import { useTokenRefresher } from "../hooks/useTokenRefresher.ts"; // 토큰 재발급용 훅
// import { ChatModalWrapper } from "@/components/chats/ChatModalWrapper";

// export type { GameData, Player, RoundResult, PlayerRanking } from "@/shared/types/game";

// function AppContent() {
//   const {
//     currentScreen,
//     isLoggedIn,
//     gameData,
//     handleEnterLobby,
//     handleJoinGame,
//     handleMatchmaking,
//     handleBackToLobby,
//     handleBackToGameJoin,
//     handleLogin,
//     handleRegister,
//     handleLogout,
//     handleLoginClick,
//     handleRegisterClick,
//     handleCloseModal,
//     handleBackToLogin,
//     handleSwitchToRegister,
//     handleSwitchToLogin,
//     handleForgotPassword,
//     handleStartGame,
//     handleRoundComplete,
//     handleNextRound,
//     handleGameEnd
//   } = useGameLogic();

//   useTokenRefresher();

//   // 게임 플로우 화면들만 렌더링 (랜딩 페이지 제외)
//   const renderGameScreens = () => {
//     switch (currentScreen) {
//       case "lobby":
//         return <LobbyScreen onLogout={handleLogout} onStartGame={handleJoinGame} />;
//       case "game-join":
//         return <GameJoinScreen onMatchmaking={handleMatchmaking} onBack={handleBackToLobby} />;
//       case "waiting-room":
//         return <GameWaitingRoom onStartGame={handleStartGame} onBack={handleBackToGameJoin} gameMode={gameData?.mode || 'custom'} />;
//       case "game":
//         return gameData ? <GameScreen gameData={gameData} roomId={gameData.roomId} onRoundComplete={handleRoundComplete} onGameEnd={handleGameEnd} /> : null;
//       case "round-result":
//         return gameData ? <RoundResultScreen gameData={gameData} onNextRound={handleNextRound} onGameEnd={handleGameEnd} /> : null;
//       case "final-result":
//         return gameData ? <FinalResultScreen gameData={gameData} onGameEnd={handleGameEnd} /> : null;
//       default:
//         return null;
//     }
//   };

//   // 게임 플로우 화면들 (로비부터 게임 끝까지)
//   const gameScreenContent = renderGameScreens();
  
//   // 게임 플로우가 활성화된 경우에만 해당 화면들 표시
//   if (gameScreenContent) {
//     return (
//       <div className="h-screen w-full font-optimized bg-background overflow-hidden">
//         <AnimatePresence mode="wait">
//           <motion.div
//             key={currentScreen}
//             initial={{ opacity: 0, scale: 0.95 }}
//             animate={{ opacity: 1, scale: 1 }}
//             exit={{ opacity: 0, scale: 1.05 }}
//             transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
//             className="h-full w-full"
//             style={{ 
//               maxWidth: "100vw",
//               fontSize: "var(--text-base)",
//               fontWeight: "var(--font-weight-normal)",
//               lineHeight: "1.5"
//             }}
//           >
//             {gameScreenContent}
//           </motion.div>
//         </AnimatePresence>

//         {/* 모달들 - 게임 화면에서도 표시 */}
//         <AnimatePresence>
//           {currentScreen === "login" && (
//             <LoginForm 
//               onLogin={handleLogin}
//               onClose={handleCloseModal}
//               onSwitchToRegister={handleSwitchToRegister}
//               onForgotPassword={handleForgotPassword}
//             />
//           )}
//           {currentScreen === "register" && (
//             <RegisterForm 
//               onRegister={handleRegister}
//               onClose={handleCloseModal}
//               onSwitchToLogin={handleSwitchToLogin}
//             />
//           )}
//           {currentScreen === "forgot-password" && (
//             <ForgotPasswordForm 
//               onClose={handleCloseModal}
//               onBackToLogin={handleBackToLogin}
//             />
//           )}
//         </AnimatePresence>
//       </div>
//     );
//   }

//     // 기본적으로 랜딩 페이지와 모달들 표시
//   return (
//     <div 
//       className="font-optimized min-h-screen bg-background relative"
//       style={{
//         fontSize: "var(--text-base)",
//         fontWeight: "var(--font-weight-normal)", 
//         lineHeight: "1.5",
//         maxWidth: "100vw",
//         overflowX: "hidden"
//       }}
//     >
//       <LandingPage
//         isLoggedIn={isLoggedIn}
//         onLoginClick={handleLoginClick}
//         onRegisterClick={handleRegisterClick}
//         onLogout={handleLogout}
//         onGameStart={handleEnterLobby}
//       />

//       <AnimatePresence>
//         {currentScreen === "login" && (
//           <LoginForm 
//             onLogin={handleLogin}
//             onClose={handleCloseModal}
//             onSwitchToRegister={handleSwitchToRegister}
//             onForgotPassword={handleForgotPassword}
//           />
//         )}
//         {currentScreen === "register" && (
//           <RegisterForm 
//             onRegister={handleRegister}
//             onClose={handleCloseModal}
//             onSwitchToLogin={handleSwitchToLogin}
//           />
//         )}
//         {currentScreen === "forgot-password" && (
//           <ForgotPasswordForm 
//             onClose={handleCloseModal}
//             onBackToLogin={handleBackToLogin}
//           />
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }

// export default function App() {
//   return (
//     <ThemeProvider>
//       <AppContent />
//       <ChatModalWrapper />
//     </ThemeProvider>
//   );
// }




// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import { LoginForm } from "@/pages/LoginForm";
import { RegisterForm } from "@/pages/RegisterForm";
import { LobbyScreen } from "@/pages/LobbyScreen";
import { GameJoinScreen } from "@/pages/GameJoinScreen";
import { GameScreen } from "@/pages/GameScreen";
import { RoundResultScreen } from "@/pages/RoundResultScreen";
import { FinalResultScreen } from "@/pages/FinalResultScreen";
import { LandingPage } from "@/pages/LandingPage";
import { ThemeProvider } from "@/shared/lib/ThemeContext";
import { ChatModalWrapper } from "@/components/chats/ChatModalWrapper";
import { GameLogicProvider, useGame } from "@/shared/hooks/gameLogicContext";
import { ForgotPasswordForm } from "@/pages/ForgotPasswordForm";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { useUserWebSocket } from "@/shared/hooks/useUserWebSocket";
import { QuickMatchWaitingRoom } from "@/pages/QuickMatchWaitingRoom";
import { CustomGameWaitingRoom } from "@/pages/CustomGameWaitingRoom";
import { InvitationModal } from "@/shared/ui/InvitationModal"; // 1. 초대 모달 import
import { useGlobalWebSocket } from "@/shared/hooks/useGlobalWebSocket"; // 전역 웹소켓 훅

export type { GameData, Player, RoundResult, PlayerRanking } from "@/shared/types/game";
import type { Player } from "@/shared/types/game";

// 게임 디자인 수정을 위한 개별 라우터 설정
import { BringIt } from "@/components/game/games"
import { ColorKiller } from "@/components/game/games"
import { FaceIt } from "@/components/game/games";
// import { ShowMeTheArt } from "@/components/game/games";
// import { TheFastestFinger } from "@/components/game/games";
// import { VoiceCrack } from "@/components/game/games/VoiceCrack"; // 경로 맞게 조정


import { useState, useEffect, useRef } from 'react'

// FaceIt 컴포넌트에서 사용될 감정 목록
const emotionPrompts = [
  "행복",
  "슬픔", 
  "화남",
  "놀람",
  "무서움",
  "역겨움",
  "무표정"
];

const objectPrompts = [
  "컵",
  "스마트폰", 
  "키보드",
  "마우스",
  "책",
  "연필",
  "안경"
];

// ColorKiller 컴포넌트에서 사용될 색상 목록 (테스트용)
const colorPrompts = [
  { r: 255, g: 0, b: 0, name: "빨간색" },
  { r: 0, g: 255, b: 0, name: "초록색" },
  { r: 0, g: 0, b: 255, name: "파란색" },
  { r: 255, g: 255, b: 0, name: "노란색" },
  { r: 255, g: 0, b: 255, name: "보라색" },
  { r: 255, g: 165, b: 0, name: "주황색" },
  { r: 255, g: 255, b: 255, name: "흰색" },
  { r: 0, g: 0, b: 0, name: "검은색" }
];

function BringItRoute() { //<--여기가 핵심
  const [timeLeft, setTimeLeft] = useState(60);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isGameActive, setIsGameActive] = useState(true);

  // 무작위로 감정 제시어를 선택하여 gameData에 포함
  const [targetEmotion] = useState(() => {
    return emotionPrompts[Math.floor(Math.random() * emotionPrompts.length)];
  });

  const testGameData = {
    roomId: 123,
    roundIdx: 1,
    gameCode: 2, // 'FaceIt'에 해당하는 가상 코드
    gameName: "FaceIt",
    gameDescription: "제시된 감정을 표정으로 표현하세요!",
    gameInstruction: targetEmotion, // 무작위로 선택된 감정을 gameData에 전달
    timeLimit: 60,
  };

  useEffect(() => {
    // 카메라 스트림 가져오기
    const getStream = async () => {
      try {
        const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = userStream;
        }
      } catch (err) {
        console.error("카메라 접근 오류:", err);
      }
    };
    getStream();

    // 타이머 로직
    if (!isGameActive) return;
    const timer = setInterval(() => {
      setTimeLeft(prevTime => (prevTime > 0 ? prevTime - 1 : 0));
    }, 1000);
    
    if (timeLeft === 0) {
        setIsGameActive(false);
    }
    
    return () => clearInterval(timer);
  }, [isGameActive, timeLeft]);
  
  const handleGameEnd = () => {
    console.log("게임 종료 요청됨");
    setIsGameActive(false);
    setTimeLeft(0);
  };
  
  const handleGameComplete = (success: boolean) => {
    if (success) {
      console.log("게임 성공!");
    } else {
      console.log("게임 실패!");
    }
    setIsGameActive(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <FaceIt
        timeLeft={timeLeft}
        videoRef={videoRef}
        isGameActive={isGameActive}
        onGameComplete={handleGameComplete}
        onGameEnd={handleGameEnd}
        participants={[]}
        gameData={testGameData} // gameData 전달 
      />
    </div>
  );
}



// --- 로그인 보호용 래퍼 ---
function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isLoggedIn } = useGame();
  if (!isLoggedIn) {
    // 로그인 안됐으면 랜딩으로
    return <Navigate to="/" replace />;
  }
  return children;
}

// --- 라우팅된 화면에서 기존 콜백을 네비게이션으로 매핑 ---
function LobbyRoute() {
  const { handleLogout } = useGame();
  const navigate = useNavigate();

  return (
    <LobbyScreen
      onLogout={handleLogout}
      onStartGame={() => navigate("/join")}
    />
  );
}

function GameJoinRoute() {
  const { handleMatchmaking } = useGame();
  const navigate = useNavigate();

  return (
    <GameJoinScreen
      onBack={() => navigate("/lobby")}
      onMatchmaking={(rounds, mode) => {
        handleMatchmaking(rounds, mode); // ✅ 인자 2개 그대로 전달
        navigate(`/waiting?mode=${mode}&rounds=${rounds}`); // 선택사항
      }}
    />
  );
}

function WaitingRoomRoute() {
  const { handleStartGame } = useGame();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const mode = (params.get("mode") as "quick" | "custom") ?? "custom";
  const invitedRoomId = params.get("roomId"); // 초대받은 roomId 읽기

  const handleGameStart = (players: Player[], roomUid: number) => {
    console.log("🎮 App.tsx: 게임 시작 - 네비게이션 시작");
    handleStartGame(players, roomUid);
  };

  if (mode === 'quick') {
    return (
      <QuickMatchWaitingRoom
        onStartGame={handleGameStart}
        onBack={() => navigate("/join")}
      />
    );
  }

  return (
    <CustomGameWaitingRoom
      onStartGame={handleGameStart}
      onBack={() => navigate("/join")}
      invitedRoomId={invitedRoomId ? Number(invitedRoomId) : undefined} // roomId 전달
    />
  );
}

// --- 비밀번호 재설정 라우트 (메일 링크 진입용 /resetpassword?token=...) ---
function ResetPasswordRoute() {
  // ResetPasswordPage 내부에서 useSearchParams로 token 읽고, 성공 시 navigate("/")
  return <ResetPasswordPage />;
}

// --- 기존 상태 머신 화면은 그대로 유지(원하면 라우팅으로 나중에 추가) ---
function GameFlowScreens() {
  const navigate = useNavigate();
  const {
    currentScreen,
    gameData,
    handleLogin,
    handleRegister,
    handleCloseModal,
    handleSwitchToRegister,
    handleSwitchToLogin,
    handleForgotPassword,
    handleNextRound,
    handleGameEnd,
  } = useGame();

  // 라우팅된 페이지들 외의(게임 본편)만 스위치 유지
  const renderGameScreens = () => {
    
    switch (currentScreen) {
      case "game":
        return <GameScreen />;
      case "round-result":
        return gameData ? (
          <RoundResultScreen
            gameData={gameData}
            onNextRound={handleNextRound}
            onGameEnd={handleGameEnd}
          />
        ) : null;
      case "final-result":
        return gameData ? (
          <FinalResultScreen
            gameData={gameData}
            onGameEnd={handleGameEnd}
            roomId={gameData.roomId.toString()}
          />
        ) : null;
      // Landing 페이지에서는 아무것도 렌더링하지 않음
      case "landing":
        return null;
      default:
        // 게임 진행 중이 아닐 때는 아무것도 렌더링하지 않음
        return null;
    }
  };

  const gameScreenContent = renderGameScreens();

  // 게임 본편(진행 중)일 때만 렌더링하도록 수정
  if (!gameScreenContent) {
    // 게임 진행중이 아닐 때는 모달만 렌더링할 수 있도록 분리
    return (
      <AnimatePresence>
        {currentScreen === "login" && (
          <LoginForm
            onLogin={() => {
              handleLogin();
              navigate("/lobby");
            }}
            onClose={handleCloseModal}
            onSwitchToRegister={handleSwitchToRegister}
            onForgotPassword={handleForgotPassword}
          />
        )}

        {currentScreen === "register" && (
          <RegisterForm
            onRegister={() => {
              handleRegister();
              navigate("/lobby");
            }}
            onClose={handleCloseModal}
            onSwitchToLogin={handleSwitchToLogin}
          />
        )}

        {/* ⭐ 비밀번호 찾기 모달 */}
        {currentScreen === "forgot-password" && (
          <ForgotPasswordForm
            onClose={handleCloseModal}
            onBackToLogin={handleSwitchToLogin}
          />
        )}
      </AnimatePresence>
    );
  }

  // 게임 본편(진행 중)일 때 전체 화면을 덮어서 렌더링
  return (
    <div className="fixed inset-0 z-50 h-screen w-full bg-background">
      {gameScreenContent}
    </div>
  );
}

function AppRoutes() {
  const {
    isLoggedIn,
    handleLoginClick,
    handleRegisterClick,
    handleLogout,
  } = useGame();
  const navigate = useNavigate();

  return (
    <Routes>
      {/* 랜딩 */}
      <Route
        path="/"
        element={
          <LandingPage
            isLoggedIn={isLoggedIn}
            onLoginClick={handleLoginClick}
            onRegisterClick={handleRegisterClick}
            onLogout={handleLogout}
            onGameStart={() => {
              if (isLoggedIn) {
                navigate("/lobby"); // ✅ 로그인 상태면 로비로 이동
              } else {
                handleLoginClick(); // ✅ 비로그인 상태면 로그인 모달 오픈
              }
            }}
          />
        }
      />

      {/* ⭐ 비밀번호 재설정(메일 링크) - 비보호 라우트 */}
      <Route path="/reset-password" element={<ResetPasswordRoute />} />

      {/* 게임 라우터 */}
        <Route
          path="/bringit"
          element={
            <ProtectedRoute>
              <BringItRoute />
            </ProtectedRoute>
          }
        />

      {/* 보호 라우트들 */}
      <Route
        path="/lobby"
        element={
          <ProtectedRoute>
            <LobbyRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/join"
        element={
          <ProtectedRoute>
            <GameJoinRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiting"
        element={
          <ProtectedRoute>
            <WaitingRoomRoute />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reset-password"
        element={
          <ProtectedRoute>
            <ResetPasswordRoute />
          </ProtectedRoute>
        }
      />
      {/* 그 외는 홈으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppContent() {
  useGlobalWebSocket(); // 게임 초대 등 전역 웹소켓 연결
  useUserWebSocket(); // 친구 상태, 업적 등 유저 웹소켓 연결
  const { currentScreen } = useGame(); // useGame 훅에서 currentScreen 상태 가져오기

  const isGameInProgress =
    currentScreen === "game" ||
    currentScreen === "round-result" ||
    currentScreen === "final-result";
    
  return (
    <>
      {/* 라우팅된 페이지 */}
      {!isGameInProgress && <AppRoutes />}
      {/* 라우팅 안 한 게임 본편 화면은 상태 기반으로 계속 렌더 */}
      <GameFlowScreens />
      <InvitationModal /> {/* 2. 앱 최상위에 모달 렌더링 */}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <GameLogicProvider>
          <AppContent />
          <ChatModalWrapper />
        </GameLogicProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
