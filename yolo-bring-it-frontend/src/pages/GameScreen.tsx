import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { GameType, RoundResult } from "@/shared/types/game";
import { useLiveKitStore } from "@/app/stores/livekitStore";
import { useRoomStore } from "@/app/stores/roomStore";
import { useGameStore } from "@/app/stores/gameStore";
import { livekitService } from "@/shared/services/livekitService";
import { Room, ConnectionState } from 'livekit-client';
import { useGameWebSocket } from "@/shared/hooks/useGameWebSocket";
import { useAuthStore } from "@/app/stores/authStore";
import apiClient from "@/shared/services/api";
import { toast } from "sonner";
import { GameCountdownScreen, GameIntroScreen } from "@/components/game";
import {
  BringIt,
  FaceIt,
  BlinkBattle,
  VoiceCrack,
  TrapWord,
  TheFastestFinger,
  TimeSniper,
  ColorKiller,
  HeadBanging,
  ShowMeTheArt,
  ScreenDisappear,
} from '@/components/game/games';
import { useGameLogic } from "@/shared/hooks/useGameLogic";
import {
  RoomContext,
} from '@livekit/components-react';

// const colorPrompts = [
//   { r: 255, g: 0, b: 0, name: '빨간색' },
//   { r: 0, g: 255, b: 0, name: '초록색' },
//   { r: 0, g: 0, b: 255, name: '파란색' },
//   { r: 255, g: 255, b: 0, name: '노란색' },
//   { r: 255, g: 0, b: 255, name: '보라색' },
//   { r: 255, g: 165, b: 0, name: '주황색' },
//   { r: 255, g: 255, b: 255, name: '흰색' },
//   { r: 0, g: 0, b: 0, name: '검은색' },
// ];

// TODO: shared/types/game.d.ts 등으로 이동
interface StaticGameData {
  gameCode: number;
  gameName: string;
  gameDescription: string;
}

interface DynamicGameData {
  roundIdx: number;
  roomId: number;
  type: string;
  startAt: number;
  durationMs: number;
  keywords: { [key: string]: string };
  // targetRgb?: { r: number, g: number, b: number };
}

export function GameScreen() {
  const location = useLocation();
  const { roomUid: initialRoomId } = useRoomStore.getState() || {}
  // 2. 불필요한 변수 제거
  const { gameData, updateGameData, handleRoundComplete } = useGameLogic();

  const setGamePhase = useGameStore((state) => state.setGamePhase);
  const gamePhase = gameData.gamePhase;
  
  const [countdown, setCountdown] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerReady, setIsTimerReady] = useState<boolean>(false);
  
  // 1. 새로운 상태 추가
  //const [staticGameData, setStaticGameData] = useState<StaticGameData | null>(null);
  //const [dynamicGameData, setDynamicGameData] = useState<DynamicGameData | null>(null);

  const { user } = useAuthStore();

  const {
    room,
    livekitUrl,
    setRoom,
    addParticipant,
    removeParticipant,
    setConnecting,
    setConnected,
    setError,
    reset: resetLivekit
  } = useLiveKitStore();

  const effectRan = useRef(false);

  const {
    // 2. 불필요한 변수 제거
  } = useGameWebSocket({
    roomId: initialRoomId ?? undefined,
    onRoundIntro: (data) => {
      console.log('🎮 ROUND_INTRO 수신:', data);

      try {
        const { roomId, type, roundIdx, startAt, durationMs, keywords } = data;
        
        const updatePayload: Partial<GameData> = {
          roomId,
          currentRound: roundIdx,
          roundIdx,
          // gameInstruction: keywords["ko"],
          timeLimit: durationMs,
          gameType: type,
          startAt,
          keywords,
        };
        
        if (keywords && 'r' in keywords && 'g' in keywords && 'b' in keywords) {
          updatePayload.gameInstruction = "제시된 색상을 찾으세요!";
          updatePayload.targetColor = {
            r: parseInt(keywords.r, 10),
            g: parseInt(keywords.g, 10),
            b: parseInt(keywords.b, 10),
          };
        } else if (keywords && 'ko' in keywords) {
          updatePayload.gameInstruction = keywords.ko;
        } else {
          updatePayload.gameInstruction = "";
        }

        updateGameData(updatePayload);
      } catch (error) {
        toast.error('이번 라운드 정보를 불러오는 데 실패했습니다.');
      }

      setIsTimerReady(false); // 라운드 시작 시 타이머 준비상태 초기화
      setGamePhase("explainIntro");
    },
    onRoundEnd: (data) => {
      console.log('🏁 ROUND_ENDED 수신:', data);
      const currentGameData = useGameStore.getState();
      const currentRoom = useLiveKitStore.getState().room;

      if (Array.isArray(data.leaderboard)) {
        // 리더보드에 누락된 참가자들 추가
        let completeLeaderboard = [...data.leaderboard];
        if (currentRoom && (data.leaderboard.length < currentRoom.numParticipants)) {
          const existingPlayerIds = new Set(data.leaderboard.map((entry: any) => entry.memberId.toString()));
          const allParticipants = [currentRoom.localParticipant, ...Array.from(currentRoom.remoteParticipants.values())];
          const missingParticipants = allParticipants.filter(participant => !existingPlayerIds.has(participant.identity));
          
          const lastOne = completeLeaderboard[completeLeaderboard.length - 1] ?? { rank: 0 }
          const additionalEntries = missingParticipants.map((participant, index) => ({
            memberId: parseInt(participant.identity) || 0,
            rank: lastOne.rank + 1,
            totalScore: 0,
          }));
          
          completeLeaderboard = [...data.leaderboard, ...additionalEntries];
        }

        const mapping: Record<number, GameType> = {
            1: "bring_object",      // 물건 가져오기 → BringIt.tsx
            2: "expression",        // 감정 표현하기 → FaceIt.tsx
            3: "color_similar",     // 비슷한 색 가져오기 → ColorKiller.tsx
            4: "drawing",           // 그림 그리기 → ShowMeTheArt.tsx
            // 5: "blink",             // 눈싸움 → BlinkBattle.tsx
            // 6: "famous_line",       // 명대사 따라하기 → VoiceCrack.tsx
            // 7: "forbidden_word",    // 금지 단어 게임 → TrapWord.tsx
            // 8: "timing_click",      // 타이밍 게임 → TimeSniper.tsx (정확한 시간에 버튼 클릭)
            // 9: "quick_press",       // 반응속도 게임 → TheFastestFinger.tsx
            // 10: "headbanging",      // 플래피버드 → HeadBanging.tsx
            // 11: "disappear",       // 사라진 부분 찾기 → ScreenDisappear.tsx
          };

        const result: RoundResult = {
          round: currentGameData.roundIdx,
          gameType: mapping[data.gameCode],
          rankings: completeLeaderboard.map((r: any) => ({
            playerId: r.memberId.toString(),
            rank: r.rank,
            score: r.totalScore,
            performance: ""
          }))
        };
        setGamePhase('complete')
        handleRoundComplete(result, currentGameData);
      }
    },
    onGameScore: (data) => {
      console.log('📊 점수 업데이트 수신:', data);
    },
    onError: (error) => {
      console.error('❌ 웹소켓 에러:', error);
    }
  });

  const connectToLiveKit = async () => {
    if (!initialRoomId) return;

    setConnecting(true);
    setError(null);
    try {
      const token = await livekitService.getLiveKitToken(initialRoomId.toString());
      const livekitRoom = new Room({ dynacast: true });
      livekitRoom.on('participantConnected', (participant: any) => addParticipant(participant));
      livekitRoom.on('participantDisconnected', (participant: any) => removeParticipant(participant));
      livekitRoom.on('disconnected', () => { setConnected(false); setConnecting(false); });
      livekitRoom.on('connectionStateChanged', async (state) => {
        if (state === ConnectionState.Connected) {
          await livekitRoom.localParticipant.setCameraEnabled(true);
          await livekitRoom.localParticipant.setMicrophoneEnabled(true);
        }
      });
      await livekitRoom.connect(livekitUrl, token);
      // 룸 객체를 집어넣음
      setRoom(livekitRoom);
      setConnected(true);
      setConnecting(false);

      //const me = livekitRoom.localParticipant;

      //console.log("mmmm", me)
      // ② 이미 방에 있던 사람들 (RemoteParticipant)
      //const existing = Array.from(livekitRoom.remoteParticipants.values());
      //console.log("ttt", existing)
    } catch (error) {
      setError('LiveKit 연결에 실패했습니다.');
      setConnecting(false);
    }
  };

  const disconnectFromLiveKit = () => {
    if (room) room.disconnect();
    resetLivekit();
  };

  // 5. 기존 fetchRoundInfo useEffect 제거

  // LiveKit 연결 로직은 유지
  useEffect(() => {
    if (effectRan.current === true) return;
    if (initialRoomId) connectToLiveKit();
    effectRan.current = true;
    return () => disconnectFromLiveKit();
  }, [initialRoomId]);

  // gameData가 변경될 때마다 gamePhase를 업데이트
  useEffect(() => {
    if (gamePhase === "loading") { 
      // 맨 처음 게임 시작 후에만 countdown 진행
      // todo 이 부분 리팩토링 필요
      setCountdown(3);
      setGamePhase("countdown");
    }
  }, [gamePhase]);

  // ✅ 카운트다운 전용
  useEffect(() => {
    if (gamePhase !== "countdown") return;

    // 남은 초 감소 (클로저 이슈 방지: 함수형 업데이트)
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }

    // countdown === 0 일 때 한 번만 호출
    const t = setTimeout(() => {
      (async () => {
        try {
          const { roomUid, currentRound } = useRoomStore.getState();
          const response = await apiClient.get(`/games/in-game-rounds/${roomUid}/${currentRound}`);
          if (!response?.data) throw new Error("유효하지 않은 라운드 정보 형식");
          //setStaticGameData(response.data.data);
          const staticData = response.data.data;
          
          updateGameData({
            gameName: staticData.gameName,
            gameCode: staticData.gameCode,
            gameDescription: staticData.gameDescription
          })
          
          // 필요 시 다음 페이즈로 이동
          // setGamePhase("explainIntro"); 혹은 "playing"
        } catch (e) {
          console.error(e);
          // toast.error("라운드 정보를 불러오지 못했습니다.");
        }
      })();
    }, 500);

    return () => clearTimeout(t);
  }, [gamePhase, countdown]);

  // ✅ 설명(인트로) 대기 전용
  useEffect(() => {
    if (gamePhase !== "explainIntro" || !gameData) return;

    // 인트로 화면에 표시할 정보 구성
    const { currentRound, roundNum, roomUid  } = useRoomStore.getState();
    const currentGameData = useGameStore.getState();
    
    // LiveKit room 참가자들을 Player 타입으로 변

    const players = room ? [
      // 로컬 참가자 (나 자신)
      {
        id: room.localParticipant.identity,
        name: room.localParticipant.name || `Player ${room.localParticipant.identity}`,
        avatar: `https://api.dicebear.com/8.x/pixel-art/svg?seed=${room.localParticipant.identity}`,
        totalScore: 0,
        roundScores: [],
        isCurrentUser: true
      },
      // 원격 참가자들
      ...Array.from(room.remoteParticipants.values()).map(participant => ({
        id: participant.identity,
        name: participant.name || `Player ${participant.identity}`,
        avatar: `https://api.dicebear.com/8.x/pixel-art/svg?seed=${participant.identity}`,
        totalScore: 0,
        roundScores: [],
        isCurrentUser: false
      }))
    ] : [];

    /*updateGameData({
      gameName: staticGameData?.gameName,
      gameCode: staticGameData?.gameCode,
      players: players,
      totalRounds: roundNum,
      roomId: roomUid,
      roundIdx: dynamicGameData?.roundIdx,
      timeLimit: dynamicGameData?.durationMs,
      gameType: dynamicGameData?.type,
      gameDescription: staticGameData?.gameDescription,
      gameInstruction: dynamicGameData.keywords["ko"],
      roundResults: [],
      currentRound,
    });*/

    if (currentGameData.players.length < players.length) {
        updateGameData({
          players: players,
          totalRounds: roundNum,
          roomId: roomUid,
          roundResults: [],
          currentRound,
        });
    }

    const { startAt } = currentGameData;

    const tick = () => {
      if (Date.now() >= startAt) {
        console.log("🎯 설명 시간 종료, 게임 시작!");
        if (gameData.timeLimit) {
          setTimeLeft(gameData.timeLimit / 1000);
          setIsTimerReady(true);
        }
        setGamePhase("playing");
      }
    };

    // 즉시 한 번 체크 후, 100ms 간격 폴링
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [gamePhase, room]);

  // 6. 새로운 타이머 로직 구현
  useEffect(() => {
    if (gamePhase === "playing" && gameData) {
      const { startAt, timeLimit } = gameData;
      const endTime = startAt + timeLimit;

      const timer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        setTimeLeft(remaining / 1000);

        if (remaining === 0) {
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gamePhase, gameData]);

  if (gamePhase === "loading") return <div>라운드 정보를 불러오는 중...</div>;
  if (gamePhase === "countdown") {
    // todo 리팩토링 필요
    //if (!gameData) return <div>게임 정보를 기다리는 중...</div>;
    return <GameCountdownScreen gameData={gameData} countdown={countdown} />;
  }
  if (gamePhase === "explainIntro" && gameData) {
    return <GameIntroScreen gameData={gameData} />
  }
  if (gamePhase === "playing") {
    if (!isTimerReady) {
      return <div>게임 로딩 중...</div>;
    }
    if (gameData) {
      switch (gameData.gameCode) {
        case 1: // bring it
          if (room) {
            return (
              <RoomContext.Provider value={room}>
                <BringIt room={room} gameData={gameData} timeLeft={timeLeft} />
              </RoomContext.Provider>
            );
          }
        case 2: // face it
          if (room) {
            return (
              <RoomContext.Provider value={room}>
                <FaceIt room={room} gameData={gameData} timeLeft={timeLeft} />
              </RoomContext.Provider>
            );
          }
        case 3: // color killer
          if (room) {
            return (
              <RoomContext.Provider value={room}>
                <ColorKiller
                  room={room}
                  gameData={gameData}
                  timeLeft={timeLeft}
                />
              </RoomContext.Provider>
            );
          }
        case 4: // show me the art
          if (room) {
            return (
              <RoomContext.Provider value={room}>
                <ShowMeTheArt
                  room={room}
                  gameData={gameData}
                  timeLeft={timeLeft}
                />
              </RoomContext.Provider>
            );
          }
        default:
          return <p>알 수 없는 게임 코드: {gameData.gameCode}</p>;
      }
    }
  }

  return null;
}