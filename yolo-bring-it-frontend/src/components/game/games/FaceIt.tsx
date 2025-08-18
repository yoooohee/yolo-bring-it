import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/shared/services/api";

import { Camera, Mic, Video, X, CheckCircle, XCircle } from "lucide-react";
import { useIsPortrait } from "@/shared/ui/use-window-size";
import { useUserLoginStore } from '@/app/stores/userStore';
import { Room, Track } from 'livekit-client';
import type { GameData } from "@/shared/types/game";

import {
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";

interface FaceItProps {
  timeLeft: number;
  room: Room;
  onGameComplete?: () => void;
  onGameEnd?: () => void;
  gameData: GameData; 
}

const emotionEmojis: Record<string, string> = {
  "행복": "😊",
  "슬픔": "😢", 
  "화남": "😠",
  "놀람": "😲",
  "무서움": "😨",
  "역겨움": "🤢",
  "무표정": "😐"
};

export function FaceIt({
  timeLeft,
  room,
  onGameComplete,
  onGameEnd,
  gameData,
}: FaceItProps) {
  const isPortrait = useIsPortrait();
  const { userData } = useUserLoginStore();
  const wallRef = useRef<HTMLDivElement>(null);

  const onToggleVideo = async () => {
    if (room?.localParticipant) {
      const enabled = room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(!enabled);
    }
  };

  const onToggleAudio = async () => {
    if (room?.localParticipant) {
      const enabled = room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(!enabled);
    }
  };

  if (!gameData || !userData) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500 text-lg">
        게임 데이터가 유효하지 않습니다.
      </div>
    );
  }

  const {
    gameName,
    gameDescription,
    keywords,
    roomId,
    roundIdx,
    gameCode,
  } = gameData;
  
  const koreanEmotion = keywords?.ko;
  const englishEmotion = keywords?.en;

  if (!koreanEmotion || !englishEmotion) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500 text-lg">
        유효하지 않은 감정 제시어입니다.
      </div>
    );
  }

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [gameResult, setGameResult] = useState<'pending' | 'analyzing' | 'waiting' | 'pass' | 'fail' | 'timeout'>('pending');
  const [aiResults, setAiResults] = useState<string>("");
  const [, setError] = useState<string | null>(null);
  const [finalized, setFinalized] = useState(false);
  const lastAnalysisTime = useRef<number>(0);

  const [showKeyword, setShowKeyword] = useState(false);
  const [keywordVisible, setKeywordVisible] = useState(false);
  
  const finishGame = useCallback((resultType: 'pass' | 'fail' | 'timeout', message: string) => {
    if (finalized) return;
    setFinalized(true);
    setGameResult(resultType);
    setAiResults(message);
    onGameComplete?.();
  }, [finalized, onGameComplete]);

  const analyzeEmotion = useCallback(async (isFinalSubmission = false) => {
    const now = Date.now();
    if (!isFinalSubmission && now - lastAnalysisTime.current < 500) {
      return;
    }
    lastAnalysisTime.current = now;
    
    if (!wallRef.current || isAnalyzing || finalized || !userData?.memberUid) return;

    try {
      setIsAnalyzing(true);
      setError(null);
      setGameResult('analyzing');

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context를 가져올 수 없습니다.');
      }

      const container = wallRef.current;
      const video = container.querySelector("video");
      
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        throw new Error('비디오가 아직 준비되지 않았습니다.');
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('이미지를 Blob으로 변환할 수 없습니다.'));
          }
        }, 'image/jpeg', 0.8);
      });

      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');
      formData.append('doEmotion', englishEmotion);
      formData.append("roomId", gameData.roomId?.toString() ?? "");
      formData.append("roundIdx", gameData.roundIdx.toString());
      formData.append("gameCode", gameData.gameCode?.toString() ?? "");
      formData.append("userId", userData.memberUid.toString());
      
     const response = await apiClient.post(
        `/games/game-judges/${roomId}/${roundIdx}/${gameCode}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-MEMBER-UID': userData.memberUid.toString(),
          },
        }
      );
      
      if (response.status !== 200 || !response.data || !response.data.data) {
        throw new Error(`잘못된 서버 응답: ${response.status}`);
      }

      const result = response.data.data;
      console.log(result);
      const isCorrect = result.result === "PASS";

      if (isFinalSubmission) {
        const finalMessage = isCorrect 
          ? `타임아웃! 최종 표정은 '${koreanEmotion}'으로 인정되었습니다!` 
          : `타임아웃! 아쉽지만 '${koreanEmotion}' 표정 짓기에 실패했어요.`;
        finishGame('timeout', finalMessage);
        return;
      }
      
      if (isCorrect) {
        setAiResults(`좋아요! '${koreanEmotion}' 감정을 더 잘 표현해보세요! (점수: ${result.top_expressions.toFixed(2)}%)`);
      } else {
        setAiResults(`'${koreanEmotion}' 감정이 아니에요. 다시 시도해보세요!`);
      }


    } catch (error) {
      console.error('AI 감정 분석 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      setAiResults(`분석 중 오류 발생: ${errorMessage}`);
      
      if (isFinalSubmission) {
        finishGame('fail', '최종 분석 중 서버 오류가 발생했습니다.');
      }

    } finally {
      setIsAnalyzing(false);
      if (!isFinalSubmission) {
        setGameResult('waiting');
      }
    }
  }, [isAnalyzing, onGameComplete, keywords, gameData, userData, roomId, roundIdx, gameCode, englishEmotion, koreanEmotion, finalized, finishGame]);

  useEffect(() => {
    if (timeLeft <= 0 && !finalized) {
      analyzeEmotion(true); 
    }
  }, [timeLeft, finalized, analyzeEmotion]);


  useEffect(() => {
    if (gameData.timeLimit > 0 && gameResult === 'pending') {
      setTimeout(() => {
        setShowKeyword(true);
        setTimeout(() => setKeywordVisible(true), 100);
        setTimeout(() => {
          setKeywordVisible(false);
          setTimeout(() => {
            setShowKeyword(false);
            setGameResult('waiting');
          }, 300);
        }, 2500);
      }, 500);
    }
  }, [gameResult, gameData.timeLimit]);

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName);

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTyping(event.target) && gameResult === 'waiting' && !isAnalyzing && !finalized) {
        event.preventDefault();
        analyzeEmotion();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [gameResult, isAnalyzing, finalized, analyzeEmotion]);

  const formatGameTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getResultIcon = () => {
    if (gameResult === 'pass') {
      return <CheckCircle className="w-16 h-16 text-green-500" />;
    }
    if (gameResult === 'fail' || gameResult === 'timeout') {
      return <XCircle className="w-16 h-16 text-red-500" />;
    }
    return null;
  };

  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const remoteOnly = tracks.filter(tr => !tr.participant.isLocal);
  const localOnly = tracks.filter(tr => tr.participant.isLocal);

  return (
    <motion.div
      className="h-screen flex flex-col bg-gradient-to-br from-red-50 to-red-100 font-sans"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-red-100/10 via-white/50 to-red-100/10 -z-10" />
      
      <header className="flex flex-col bg-white/50 backdrop-blur-sm border-b border-red-200">
        <div className="flex items-center justify-between p-4">
          <motion.button 
            onClick={onGameEnd}
            className="p-2 rounded-lg bg-red-200 hover:bg-red-300 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-6 h-6 text-red-600" />
          </motion.button>
          
          <div className="text-center">
            <h1 className="text-xl font-bold text-red-800 tracking-wider">
              {gameName}
            </h1>
            <p className="text-sm text-gray-500">{gameDescription}</p>
          </div>
        
          <div className="flex items-center gap-2 text-red-700">
            <span className="text-lg">⏰</span>
            <motion.span 
              className="font-mono font-bold text-red-700"
            >
              {formatGameTime(timeLeft)}
            </motion.span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <div className="bg-white/50 backdrop-blur-sm border-b border-red-200 p-2 sm:p-3 lg:p-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="font-bold text-base sm:text-lg lg:text-xl text-red-700 tracking-wider">
            참가자들 ({room ? room.remoteParticipants.size + 1 : 1}명)
            </h3>
          </div>

          <div className="flex justify-center items-center gap-4 h-32">
            {remoteOnly.length > 0 ? (
              remoteOnly.map((trackRef) => (
                <div key={trackRef.participant.sid} className="h-full aspect-video rounded-lg overflow-hidden shadow-md">
                  <ParticipantTile trackRef={trackRef} />
                </div>
              ))
            ) : (
              <motion.div 
                className="w-full h-full flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="text-center">
                  <span className="text-red-500 text-sm sm:text-base lg:text-lg">다른 참가자를 기다리는 중...</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative">
          <motion.div 
            className="relative w-full max-w-4xl aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-xl border-4 border-red-400"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div ref={wallRef} className="w-full h-full">
                {localOnly.length > 0 && <ParticipantTile trackRef={localOnly[0]} />}
            </div>
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
              <motion.button
                onClick={onToggleVideo}
                className="p-3 rounded-full backdrop-blur-sm transition-colors shadow-lg bg-red-500/80 text-white"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Video className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                onClick={onToggleAudio}
                className="p-3 rounded-full backdrop-blur-sm transition-colors shadow-lg bg-red-500/80 text-white"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Mic className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="absolute top-4 left-4">
              <div className="bg-red-500/90 backdrop-blur-sm rounded-lg px-3 py-1">
                <span className="text-white text-sm font-bold">
                  나의 표정
                </span>
              </div>
            </div>

            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-red-900/90 backdrop-blur-sm z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="text-center text-white">
                    <div className="animate-spin w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                    <h3 className="text-xl mb-2">AI 분석 중</h3>
                    <p className="text-red-200">감정을 분석하고 있습니다...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(gameResult === 'pass' || gameResult === 'fail' || gameResult === 'timeout') && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="text-center"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  >
                    <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl border-4"
                      style={{ borderColor: gameResult === 'pass' || (gameResult === 'timeout' && aiResults.includes("인정")) ? '#22C55E' : '#EF4444' }}
                    >
                      <div className="flex items-center justify-center mb-4">
                        {getResultIcon()}
                      </div>
                      <h2 className={`text-3xl font-bold mb-4 ${gameResult === 'pass' || (gameResult === 'timeout' && aiResults.includes("인정")) ? 'text-green-600' : 'text-red-600'}`}>
                        {gameResult === 'pass' ? '성공!' : gameResult === 'timeout' ? '시간 초과!' : '실패!'}
                      </h2>
                      <p className="text-lg text-gray-700 mb-2">{aiResults}</p>
                      <p className="text-sm text-gray-500">
                        다른 참가자들을 기다리고 있습니다...
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showKeyword && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    className="text-center"
                    initial={{ y: -100, opacity: 0, scale: 0.8 }}
                    animate={{
                      y: keywordVisible ? 0 : -100,
                      opacity: keywordVisible ? 1 : 0,
                      scale: keywordVisible ? 1 : 0.8
                    }}
                    transition={{ type: "spring", damping: 20, stiffness: 300, duration: 0.6 }}
                  >
                    <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl">
                      <p className="text-red-600 text-base mb-2">표현할 감정</p>
                      <div className="text-6xl md:text-8xl mb-4">
                        {koreanEmotion && emotionEmojis[koreanEmotion]}
                      </div>
                      <h1 className="text-4xl md:text-6xl text-red-800">
                        {koreanEmotion}
                      </h1>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      <>
        {isPortrait && (
          <div className="p-4 flex flex-col items-center gap-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border-2 border-red-300">
              <p className="text-sm text-gray-700 mb-1 text-center">
                제시어: <span className="font-medium text-red-600">{koreanEmotion}</span>
              </p>
              <p className="text-xs text-gray-600 text-center">
                표정을 지은 후 버튼을 클릭하세요!
              </p>
            </div>
            
            <motion.button
              onClick={() => analyzeEmotion()}
              className={`px-8 py-4 rounded-full shadow-lg flex items-center gap-3 ${
                isAnalyzing || finalized
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-red-500 hover:bg-red-600'
              } text-white`}
              whileHover={isAnalyzing || finalized ? {} : { scale: 1.05 }}
              whileTap={isAnalyzing || finalized ? {} : { scale: 0.95 }}
              disabled={isAnalyzing || finalized}
            >
              <Camera className="w-6 h-6" />
              <span className="text-lg font-bold">
                {isAnalyzing ? '분석 중...' : finalized ? '게임 종료!' : '표정 캡처하기'}
              </span>
            </motion.button>
          </div>
        )}

        {!isPortrait && (
          <div className="p-4 text-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border-2 border-red-300">
              <p className="text-sm text-gray-700 mb-1">
                제시어: <span className="font-medium text-red-600">{koreanEmotion}</span>
              </p>
              <p className="text-sm text-gray-600">
                표정을 지은 후 스페이스바를 눌러 캡처하고 AI 분석을 시작하세요!
              </p>
            </div>
          </div>
        )}
      </>
    </motion.div>
  );
};