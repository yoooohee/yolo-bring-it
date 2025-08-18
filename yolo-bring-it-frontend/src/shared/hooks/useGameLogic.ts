import { useState, useEffect } from "react";
import type { Screen, GameData, Player, RoundResult, GameType } from "../types/game";
import { useUserLoginStore } from "@/app/stores/userStore";
import { useGameStore } from "@/app/stores/gameStore";
import apiClient from "@/shared/services/api";
import { GAME_TYPES, PERFORMANCE_CONFIGS, GAME_CONFIG } from "@/shared/types/game";

// 백엔드 게임 코드를 프론트엔드 GameType으로 변환
export const gameCodeToType = (gameCode: number): GameType => {
  const mapping: Record<number, GameType> = {
    1: "bring_object",      // 물건 가져오기 → BringIt.tsx
    2: "expression",        // 감정 표현하기 → FaceIt.tsx
    3: "color_similar",     // 비슷한 색 가져오기 → ColorKiller.tsx
    4: "drawing",           // 그림 그리기 → ShowMeTheArt.tsx
    5: "blink",             // 눈싸움 → BlinkBattle.tsx
    6: "famous_line",       // 명대사 따라하기 → VoiceCrack.tsx
    7: "forbidden_word",    // 금지 단어 게임 → TrapWord.tsx
    8: "timing_click",      // 타이밍 게임 → TimeSniper.tsx (정확한 시간에 버튼 클릭)
    9: "quick_press",       // 반응속도 게임 → TheFastestFinger.tsx
    10: "headbanging"       // 플래피버드 → HeadBanging.tsx
  };
  
  return mapping[gameCode] || "bring_object"; // 기본값
};

// 프론트엔드 GameType을 백엔드 게임 코드로 변환
export const gameTypeToCode = (gameType: GameType): number => {
  const mapping: Record<GameType, number> = {
    "bring_object": 1,      // 물건 가져오기 → BringIt.tsx
    "expression": 2,        // 감정 표현하기 → FaceIt.tsx
    "color_similar": 3,     // 비슷한 색 가져오기 → ColorKiller.tsx
    "drawing": 4,           // 그림 그리기 → ShowMeTheArt.tsx
    "blink": 5,             // 눈싸움 → BlinkBattle.tsx
    "famous_line": 6,       // 명대사 따라하기 → VoiceCrack.tsx
    "forbidden_word": 7,    // 금지 단어 게임 → TrapWord.tsx
    "timing_click": 8,      // 타이밍 게임 → TimeSniper.tsx
    "quick_press": 9,       // 반응속도 게임 → TheFastestFinger.tsx
    "headbanging": 10       // 플래피버드 → HeadBanging.tsx
  };
  
  return mapping[gameType] || 1; // 기본값
};

export function useGameLogic() {
  const [gameMode, setGameMode] = useState<"quick" | "custom">("custom");
  const [gameRounds, setGameRounds] = useState(3); // ✅ 3 라운드 기본값

  const gameData = useGameStore();
  const updateGameData = useGameStore((state) => state.updateGameData);
  const clearGameData = useGameStore((state) => state.clearGameData);
  const setCurrentScreen = useGameStore((state) => state.setCurrentScreen);
  
  const currentScreen = gameData.currentScreen;

  // 유저 로그인 정보 가져오기
  const userData = useUserLoginStore((state) => state.userData);
  
  // 로그인 상태는 userData를 기반으로 계산
  const isLoggedIn = !!userData?.accessToken;

  // 앱 시작 시 localStorage에서 토큰 확인 (한 번만 실행)
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    // 토큰이 있어도 자동 로그인하지 않음 - 사용자가 직접 로그인해야 함
    console.log('🔄 localStorage 토큰 확인:', { 
      hasAccessToken: !!accessToken, 
      hasRefreshToken: !!refreshToken 
    });
    
    // 자동 로그인 비활성화 - 필요시 수동으로 활성화 가능
    // if (accessToken && refreshToken && !userData) {
    //   console.log('🔄 localStorage에서 토큰 복원 중...');
    //   setUser({
    //     memberUid: 0,
    //     email: '',
    //     nickname: '',
    //     accessToken,
    //     refreshToken,
    //     coin: 0,
    //     score: 0,
    //     xp: 0,
    //     yoloScore: 0,
    //     firstWinCnt: 0,
    //     secondWinCnt: 0,
    //     thirdWinCnt: 0,
    //     useCoin: 0,
    //     playCnt: 0
    //   });
    // }
  }, []); // 의존성 배열을 빈 배열로 변경 - 앱 시작 시에만 실행

  // 인증 관련 핸들러  
  const clearUser = useUserLoginStore((state) => state.clearUser);
  
  const handleLogin = () => {
    console.log("🔐 로그인 처리 완료");
    setCurrentScreen("lobby");
  };

  const handleRegister = () => {
    console.log("📝 회원가입 처리 완료");
    setCurrentScreen("lobby");
  };

  const handleLogout = () => {
    console.log("🚪 로그아웃 처리");
    clearUser(); // zustand store에서 유저 정보 제거
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setCurrentScreen("landing");
    clearGameData();
  };

  // 화면 전환 핸들러
  const handleEnterLobby = () => {
    console.log("🎮 게임 시작 요청", { isLoggedIn, currentScreen });
    if (isLoggedIn) {
      setCurrentScreen("lobby");
    } else {
      setCurrentScreen("login");
    }
  };

  const handleJoinGame = () => {
    console.log("🎯 게임 참가 요청 - 로비에서 게임 조인으로 이동");
    setCurrentScreen("game-join");
  };

  const handleMatchmaking = (rounds: number, mode: "quick" | "custom") => {
    console.log(`🔍 매칭 요청 (라운드: ${rounds}, 모드: ${mode})`);
    setGameRounds(rounds);
    setGameMode(mode);
    setCurrentScreen("waiting-room");
  };

  const handleBackToLobby = () => {
    console.log("⬅️ 게임 조인 → 로비");
    setCurrentScreen("lobby");
  };

  const handleBackToGameJoin = () => {
    console.log("⬅️ 대기방 → 게임 조인");
    setCurrentScreen("game-join");
  };

  // 게임 시작 핸들러
  const handleStartGame = (players: Player[], roomUid: number) => {
    console.log("🚀 실제 게임 시작 요청!", { 
      playersCount: players.length,
      rounds: gameRounds,
      timestamp: new Date().toISOString()
    });
    
    if (!players || players.length === 0) {
      console.error("❌ 플레이어 데이터가 없습니다!");
      return;
    }

    // if (gameMode === "quick" && players.length < 6) {
    //   console.warn("⚠️ 빠른 매칭은 6명이 모여야 시작할 수 있습니다!");
    //   // 여기에 사용자에게 알림을 보여주는 로직을 추가할 수 있습니다 (예: 토스트 메시지).
    //   return;
    // }

    const readyCount = players.filter(p => p.isReady).length;
    console.log(`📊 플레이어 준비 상태: ${readyCount}/${players.length}`);
    
    if (readyCount < players.length) {
      console.warn("⚠️ 모든 플레이어가 준비되지 않았습니다!");
      return;
    }

    console.log("🏠 사용할 Room UID:", roomUid);

    const fetchFirstGame = async () => {
      try {
        const accessToken = userData?.accessToken;
        console.log('🔑 인증 토큰 확인:', accessToken ? '토큰 있음' : '토큰 없음');
        
        if (!accessToken) {
          throw new Error('인증 토큰이 없습니다. 로그인이 필요합니다.');
        }
        
        // 1단계: 게임 시작 API 호출
        console.log('🎮 게임 시작 API 호출...');
        await apiClient.patch(`/games/rooms/${roomUid}/status/starting`, {}, {
          headers: {
            'Content-Type': 'application/json',
            'X-MEMBER-UID': userData?.memberUid?.toString() || '',
            'Authorization': `Bearer ${accessToken}`
          }
        });
        console.log('✅ 게임 시작 성공');
        setCurrentScreen("game");
      } catch (error) {
        console.error('❌ 첫 번째 라운드 게임 정보 조회 실패:', error);
        setCurrentScreen("game");
      }
    };

    fetchFirstGame();
  };

  // 라운드 완료 핸들러
  const handleRoundComplete = (result: RoundResult, currentGameData: GameData) => {
    console.log("🎯 라운드 완료", result);
    if (!currentGameData) {
      console.error("❌ 게임 데이터가 없습니다!");
      return;
    }

    // 점수 계산 및 게임 데이터 업데이트 로직은 그대로 유지
    const enhancedRankings = result.rankings.map(ranking => {
      // BringIt 게임이 아닌 경우에만 PERFORMANCE_CONFIGS 사용
      if (result.gameType !== 'bring_object') {
        try {
          const config = PERFORMANCE_CONFIGS[result.gameType as keyof typeof PERFORMANCE_CONFIGS] as any;
          if (config && typeof config === 'object') {
            if ('decrement' in config && 'base' in config) {
              return { ...ranking, performance: `${config.base - (ranking.rank - 1) * config.decrement}` };
            } else if ('increment' in config && 'base' in config) {
              return { ...ranking, performance: `${config.base + (ranking.rank - 1) * config.increment}` };
            }
          }
        } catch (error) {
          console.warn('PERFORMANCE_CONFIGS에서 설정을 찾을 수 없습니다:', result.gameType);
        }
      }
      
      // 기본값 또는 이미 설정된 performance 사용
      return { ...ranking, performance: ranking.performance || "완료" };
    });

    const updatedResult = { ...result, rankings: enhancedRankings };

    const updatedPlayers = currentGameData.players.map(player => {
      const playerResult = enhancedRankings.find(r => r.playerId === player.id);
      const roundScore = playerResult ? (8 - playerResult.rank) * GAME_CONFIG.ROUND_SCORE_MULTIPLIER : 0;
      return {
        ...player,
        totalScore: player.totalScore + roundScore,
        roundScores: [...player.roundScores, roundScore]
      };
    });

    updateGameData({
      roundResults: [...currentGameData.roundResults, updatedResult],
      players: updatedPlayers
    });

    if (currentGameData.currentRound >= currentGameData.totalRounds) {
      console.log("🏁 게임 종료 - 최종 결과로 이동");
      setCurrentScreen("final-result");
    } else {
      setCurrentScreen("round-result");
    }
  };

  // 다음 라운드 핸들러
  const handleNextRound = function() {
    console.log("▶️ 다음 라운드 진행");

    const currentGameData = useGameStore.getState();
    if (!currentGameData) return;

    if (currentGameData.currentRound >= currentGameData.totalRounds) {
      console.log("🏁 게임 종료 - 최종 결과로 이동");
      setCurrentScreen("final-result");
      return;
    }

    const fetchNextGame = async () => {
      try {
        const accessToken = userData?.accessToken;
        console.log('🔑 다음 라운드 인증 토큰 확인:', accessToken ? '토큰 있음' : '토큰 없음');
        
        if (!accessToken) {
          throw new Error('인증 토큰이 없습니다. 로그인이 필요합니다.');
        }
        
        const roomId = currentGameData.roomId;
        const nextRound = currentGameData.currentRound + 1;
        
        console.log("important", nextRound)
        const response = await apiClient.get(`/games/in-game-rounds/${roomId}/${nextRound}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-MEMBER-UID': userData?.memberUid?.toString() || '',
            'Authorization': `Bearer ${accessToken}`
          }
        });

        const gameInfo = response.data.data;
        console.log('🎮 다음 라운드 게임 정보:', gameInfo);

        updateGameData({
          gameType: gameInfo.gameCode,
          gameCode: gameInfo.gameCode,
          gameName: gameInfo.gameName,
          gameDescription: gameInfo.gameDescription,
          gameInstruction: gameInfo.gameInstruction,
          gameIcon: gameInfo.gameIcon,
          gameRules: gameInfo.gameRules,
        });
        setCurrentScreen("game");
      } catch (error) {
        console.error('❌ 다음 라운드 게임 정보 조회 실패:', error);
        const nextGameType = GAME_TYPES[Math.floor(Math.random() * GAME_TYPES.length)];
        updateGameData({
          currentRound: gameData.currentRound + 1,
          gameType: nextGameType,
          gameName: "다음 게임 (폴백)",
          gameDescription: "다음 게임 설명 (폴백)",
        });
        setCurrentScreen("game");
      }
    };

    fetchNextGame();
  };

  const handleGameEnd = () => {
    console.log("🏁 게임 종료 - 로비로 복귀");
    clearGameData();
    setCurrentScreen("lobby");
  };

  // 모달 관련 핸들러
  const handleLoginClick = () => {
    console.log("🔐 로그인 모달 열기");
    setCurrentScreen("login");
  };

  const handleRegisterClick = () => {
    console.log("📝 회원가입 모달 열기");
    setCurrentScreen("register");
  };

  const handleCloseModal = () => {
    console.log("❌ 모달 닫기");
    // 현재 게임 화면에 있다면 로비로, 그렇지 않으면 랜딩으로
    if (currentScreen === "lobby" || currentScreen === "game-join" || currentScreen === "waiting-room" || currentScreen === "game" || currentScreen === "round-result" || currentScreen === "final-result") {
      setCurrentScreen("lobby");
    } else {
      setCurrentScreen("landing");
    }
  };

  const handleBackToLogin = () => {
    console.log("⬅️ 비밀번호 찾기 → 로그인 복귀");
    setCurrentScreen("login");
  };

  const handleSwitchToRegister = () => {
    console.log("🔄 로그인 → 회원가입 전환");
    setCurrentScreen("register");
  };

  const handleSwitchToLogin = () => {
    console.log("🔄 회원가입 → 로그인 전환");  
    setCurrentScreen("login");
  };

  const handleForgotPassword = () => {
    console.log("🔑 비밀번호 찾기 모달");
    setCurrentScreen("forgot-password");
  };

  return {
    // State
    currentScreen,
    isLoggedIn,
    gameData,
    gameMode,
    updateGameData,
    setGameMode,
    gameRounds,
    setGameRounds,
    
    // Screen handlers
    setCurrentScreen,
    handleEnterLobby,
    handleJoinGame,
    handleMatchmaking,
    handleBackToLobby,
    handleBackToGameJoin,
    
    // Auth handlers
    handleLogin,
    handleRegister,
    handleLogout,
    handleLoginClick,
    handleRegisterClick,
    handleCloseModal,
    handleBackToLogin,
    handleSwitchToRegister,
    handleSwitchToLogin,
    handleForgotPassword,
    
    // Game handlers
    handleStartGame,
    handleRoundComplete,
    handleNextRound,
    handleGameEnd
  };
}