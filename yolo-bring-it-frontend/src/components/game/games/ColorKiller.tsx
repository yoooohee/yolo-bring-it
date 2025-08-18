import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/shared/services/api";

import { Camera, Mic, Video, X, CheckCircle, XCircle } from "lucide-react";
import { useIsPortrait } from "@/shared/ui/use-window-size";
import { useUserLoginStore } from '@/app/stores/userStore';
import { Room, Track } from 'livekit-client';
import {
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";
import type { GameData } from "@/shared/types/game";

interface ColorKillerProps {
  timeLeft: number;
  room: Room;
  onGameComplete?: (success: boolean) => void;
  onGameEnd?: () => void;
  gameData: GameData;
}

export function ColorKiller({
  timeLeft,
  room,
  onGameComplete,
  onGameEnd,
  gameData,
}: ColorKillerProps) {
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

  const [gameStatus, setGameStatus] = useState<'waiting' | 'analyzing' | 'success' | 'fail'>('waiting');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<string>("");
  const [showKeyword, setShowKeyword] = useState(false);
  const [keywordVisible, setKeywordVisible] = useState(false);
  const [isPromptShownOnce, setIsPromptShownOnce] = useState(false);
  const [finalized, setFinalized] = useState(false);

  if (!gameData || !userData || !userData.memberUid) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500 text-lg">
        게임 또는 사용자 데이터가 유효하지 않습니다.
      </div>
    );
  }

  const {
    gameName,
    gameDescription,
    targetColor,
    roomId,
    roundIdx,
    gameCode,
  } = gameData;
  
  if (!targetColor) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500 text-lg">
        유효하지 않은 제시어 색상입니다.
      </div>
    );
  }

  const finishGame = useCallback((success: boolean, message: string) => {
    if (finalized) return;
    setFinalized(true);
    onGameComplete?.(success);
    setGameStatus(success ? 'success' : 'fail');
    setAiResults(message);
  }, [finalized, onGameComplete]);

  useEffect(() => {
    if (timeLeft <= 0) {
      finishGame(false, '시간 초과!');
    }
  }, [timeLeft, finishGame]);


  useEffect(() => {
    if (!isPromptShownOnce) {
      const t1 = setTimeout(() => setShowKeyword(true), 0);
      const t2 = setTimeout(() => setKeywordVisible(true), 100);
      const t3 = setTimeout(() => {
        setKeywordVisible(false);
        const t4 = setTimeout(() => {
          setShowKeyword(false);
          setIsPromptShownOnce(true);
          setGameStatus('waiting');
        }, 300);
        return () => clearTimeout(t4);
      }, 2000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [isPromptShownOnce]);

  const analyzeColor = useCallback(async () => {
    if (!wallRef?.current || !userData?.memberUid || isAnalyzing || finalized) return;
    
    setIsAnalyzing(true);
    setGameStatus('analyzing');
    
    try {
      const container = wallRef.current;
      const video = container.querySelector("video");

      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        throw new Error('비디오가 아직 준비되지 않았습니다.');
      }
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('캔버스 컨텍스트를 가져올 수 없습니다.');
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('이미지 Blob을 생성할 수 없습니다.'));
        }, 'image/jpeg', 0.8);
      });
      
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');
      
      const clamp = (n:number) => Math.max(0, Math.min(255, Math.round(n)));
      formData.append('r', clamp(targetColor.r).toString());
      formData.append('g', clamp(targetColor.g).toString());
      formData.append('b', clamp(targetColor.b).toString());
      
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
      if (result.result === 'PASS') {
        finishGame(true, `색상 분석 성공! (유사도: ${result.colorScore}%)`);
      } else {
        setGameStatus('waiting'); 
        setAiResults('비슷한 색상을 찾지 못했어요. 다시 시도해보세요!');
      }

    } catch (error) {
      console.error('AI 색상 분석 오류:', error);
      setGameStatus('waiting'); 
      setAiResults(`분석 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [userData, isAnalyzing, finalized, targetColor, roomId, roundIdx, gameCode, finishGame]);

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName);

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTyping(event.target) && gameStatus === 'waiting' && !isAnalyzing && !finalized) {
        event.preventDefault();
        analyzeColor();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [gameStatus, isAnalyzing, finalized, analyzeColor]);

  const formatGameTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const rgb = (r: number, g: number, b: number) => {
    const clamp = (n:number) => Math.max(0, Math.min(255, Math.round(n)));
    return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
  };

  const getResultIcon = () => {
    if (gameStatus === 'success') return <CheckCircle className="w-16 h-16 text-green-500" />;
    if (gameStatus === 'fail') return <XCircle className="w-16 h-16 text-red-500" />;
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
      className="h-screen flex flex-col bg-gradient-to-br from-green-50 to-green-100 font-sans"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-green-100/10 via-white/50 to-green-100/10 -z-10" />
      
      <header className="flex flex-col bg-white/50 backdrop-blur-sm border-b border-green-200">
        <div className="flex items-center justify-between p-4">
          <motion.button 
            onClick={onGameEnd}
            className="p-2 rounded-lg bg-green-200 hover:bg-green-300 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-6 h-6 text-green-600" />
          </motion.button>
          
          <div className="text-center">
            <h1 className="text-xl font-bold text-green-800 tracking-wider">
              {gameName}
            </h1>
            <p className="text-sm text-gray-500">{gameDescription}</p>
          </div>
        
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-lg">⏰</span>
            <motion.span 
              className="font-mono font-bold text-green-700"
            >
              {formatGameTime(timeLeft)}
            </motion.span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <div className="bg-white/50 backdrop-blur-sm border-b border-green-200 p-2 sm:p-3 lg:p-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="font-bold text-base sm:text-lg lg:text-xl text-green-700 tracking-wider">
              참가자들 ({room ? room.remoteParticipants.size + 1 : 1}명)
            </h3>
          </div>

          <div className="flex justify-center items-center gap-4 h-32">
            {remoteOnly.length > 0 ? (
              remoteOnly.map((trackRef) => (
                <div key={trackRef.publication?.trackSid ?? `${trackRef.participant.sid}-${trackRef.source}`} className="h-full aspect-video rounded-lg overflow-hidden shadow-md">
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
                  <span className="text-green-500 text-sm sm:text-base lg:text-lg">다른 참가자를 기다리는 중...</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative">
          <motion.div 
            className="relative w-full max-w-4xl aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-xl border-4 border-green-400"
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
                className="p-3 rounded-full backdrop-blur-sm transition-colors shadow-lg bg-green-500/80 text-white"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Video className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                onClick={onToggleAudio}
                className="p-3 rounded-full backdrop-blur-sm transition-colors shadow-lg bg-green-500/80 text-white"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Mic className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="absolute top-4 left-4">
              <div className="bg-green-500/90 backdrop-blur-sm rounded-lg px-3 py-1">
                <span className="text-white text-sm font-bold">
                  나의 색상
                </span>
              </div>
            </div>

            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-green-900/90 backdrop-blur-sm z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="text-center text-white">
                    <div className="animate-spin w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                    <h3 className="text-xl mb-2">AI 분석 중</h3>
                    <p className="text-green-200">색상을 분석하고 있습니다...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {finalized && (
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
                      style={{ borderColor: gameStatus === 'success' ? '#22C55E' : '#EF4444' }}
                    >
                      <div className="flex items-center justify-center mb-4">
                        {getResultIcon()}
                      </div>
                      <h2 className={`text-3xl font-bold mb-4 ${gameStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        🎨 {gameStatus === 'success' ? '색상 완성!' : '게임 실패!'}
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
                      <p className="text-green-600 text-base mb-2">찾을 색상</p>
                      <div className="flex items-center justify-center mb-4">
                        <div 
                          className="w-24 h-24 rounded-full border-4 border-green-300 shadow-lg"
                          style={{ backgroundColor: `rgb(${targetColor.r}, ${targetColor.g}, ${targetColor.b})` }}
                        ></div>
                      </div>
                      <h1 className="text-4xl md:text-6xl text-green-800">
                        이 색을 찾으세요!
                      </h1>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {isPortrait && (
        <div className="p-4 flex flex-col items-center gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border-2 border-green-300 flex items-center gap-3">
            <p className="text-sm text-gray-700">
              제시 색상:
            </p>
            <div 
              className="w-6 h-6 rounded-full border-2 border-white"
              style={{ backgroundColor: `rgb(${targetColor.r}, ${targetColor.g}, ${targetColor.b})` }}
            ></div>
          </div>
          
          <motion.button
            onClick={analyzeColor}
            className={`px-8 py-4 rounded-full shadow-lg flex items-center gap-3 ${
              finalized || timeLeft <= 0
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600'
            } text-white`}
            whileHover={!finalized && timeLeft > 0 ? { scale: 1.05 } : {}}
            whileTap={!finalized && timeLeft > 0 ? { scale: 0.95 } : {}}
            disabled={isAnalyzing || finalized || timeLeft <= 0}
          >
            <Camera className="w-6 h-6" />
            <span className="text-lg font-bold">
              {isAnalyzing ? '분석 중...' : gameStatus === 'success' ? '성공!' : '색상 캡처하기'}
            </span>
          </motion.button>
        </div>
      )}

      {!isPortrait && (
        <div className="p-4 text-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border-2 border-green-300 flex items-center justify-center gap-3">
            <p className="text-sm text-gray-700">
              제시 색상:
            </p>
            <div 
              className="w-6 h-6 rounded-full border-2 border-white"
              style={{ backgroundColor: `rgb(${targetColor.r}, ${targetColor.g}, ${targetColor.b})` }}
            ></div>
            <p className="text-sm text-gray-600">
              과 비슷한 물건을 보여주고 스페이스바를 눌러 캡처하세요!
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}