import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { Camera, Mic, Video, X, CheckCircle, XCircle } from "lucide-react";
import { useIsPortrait } from "@/shared/ui/use-window-size";
import apiClient from "@/shared/services/api";
import { useUserLoginStore } from "@/app/stores/userStore";
import type { GameData } from "@/shared/types/game";
import { Room, Track } from 'livekit-client';
import {
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";

interface DetectedObject {
  label: string;
  confidence: number;
}

interface BringItProps {
  timeLeft: number;
  onGameComplete?: (success: boolean, aiResults?: DetectedObject[], score?: number) => void;
  onGameEnd?: () => void;
  gameData: GameData;
  room: Room;
}

export function BringIt({
  timeLeft,
  onGameComplete,
  onGameEnd,
  gameData,
  room,
}: BringItProps) {
  const isPortrait = useIsPortrait();
  const { userData } = useUserLoginStore();
  const wallRef = useRef<HTMLDivElement>(null);

  const {
    gameName,
    gameDescription,
    keywords,
    roomId,
    roundIdx,
    gameCode,
  } = gameData;

  const koreanTarget = keywords?.ko;
  const englishTarget = keywords?.en;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [gameResult, setGameResult] = useState<'waiting' | 'analyzing' | 'pass' | 'fail' | 'timeout' | 'nothing'>('waiting');
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [aiMessage, setAiMessage] = useState<string>("");
  const [, setError] = useState<string | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [isPromptShownOnce, setIsPromptShownOnce] = useState(false);

  const [showKeyword, setShowKeyword] = useState(false);
  const [keywordVisible, setKeywordVisible] = useState(false);
  
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

  const finishGame = useCallback((success: boolean, resultType: 'pass' | 'fail' | 'timeout', message: string, detected: DetectedObject[] = [], score?: number) => {
    if (finalized) return;
    setFinalized(true);
    setGameResult(resultType);
    setAiMessage(message);
    setDetectedObjects(detected);
    onGameComplete?.(success, detected, score);
  }, [finalized, onGameComplete]);


  const analyzeFrame = useCallback(async () => {
    if (!wallRef?.current || isAnalyzing || !userData || finalized) return;
    
    const container = wallRef.current;
    const video = container.querySelector("video");

    try {
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        throw new Error('비디오가 아직 준비되지 않았습니다.');
      }

      setIsAnalyzing(true);
      setError(null);
      setGameResult('analyzing');

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas context를 가져올 수 없습니다.');

      const MAX_WIDTH = 800;
      const scale = MAX_WIDTH / video.videoWidth;
      canvas.width = MAX_WIDTH;
      canvas.height = video.videoHeight * scale;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('이미지를 Blob으로 변환할 수 없습니다.'));
        }, 'image/jpeg', 0.9);
      });

      const formData = new FormData();
      formData.append("image", blob, "capture.jpg");
      if (englishTarget) {
        formData.append("targetItem", englishTarget);
      }
      
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
      const isSuccess = result.result === 'PASS';
      
      const detected = Array.isArray(result.results) 
        ? result.results.map((obj: any) => ({ label: obj.label, confidence: obj.confidence })) 
        : [];

      if (isSuccess) {
        const score = gameData.timeLimit > 0 ? Math.floor((timeLeft / gameData.timeLimit) * 100) : 0;
        finishGame(true, 'pass', `'${koreanTarget}'을(를) 성공적으로 인식했습니다!`, detected, score);
      } else {
        setGameResult('fail');
        setAiMessage(`'${koreanTarget}'을(를) 찾지 못했습니다. 다시 시도해보세요!`);
        setTimeout(() => setGameResult('waiting'), 3000);
      }
    } catch (error) {
      console.error('AI 분석 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      setGameResult('fail');
      setAiMessage(`분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`);
      setTimeout(() => setGameResult('waiting'), 3000);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, timeLeft, gameData, userData, englishTarget, koreanTarget, roomId, roundIdx, gameCode, finalized, finishGame]);

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
    
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTyping(event.target) && !finalized && !isAnalyzing && (gameResult === 'waiting' || gameResult === 'fail')) {
        event.preventDefault();
        analyzeFrame();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameResult, analyzeFrame, finalized, isAnalyzing]);

  useEffect(() => {
    if (!isPromptShownOnce && gameResult === 'waiting') {
      setIsPromptShownOnce(true);

      const t1 = setTimeout(() => {
        setShowKeyword(true);
        const t2 = setTimeout(() => {
          setKeywordVisible(true);
          const t3 = setTimeout(() => {
            setKeywordVisible(false);
            const t4 = setTimeout(() => {
              setShowKeyword(false);
            }, 300);
            return () => clearTimeout(t4);
          }, 2500);
          return () => clearTimeout(t3);
        }, 1000);
        return () => clearTimeout(t2);
      }, 500);
      
      return () => clearTimeout(t1);
    }
  }, [gameResult, isPromptShownOnce]);
  
  useEffect(() => {
    if (timeLeft <= 0 && !finalized) {
      finishGame(false, 'timeout', '시간 초과! 미션을 완수하지 못했습니다.');
    }
  }, [timeLeft, finalized, finishGame]);


  const formatGameTime = (seconds: number): string => {
    const validSeconds = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
    const mins = Math.floor(validSeconds / 60);
    const secs = validSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const remoteOnly = tracks.filter(tr => !tr.participant.isLocal);
  const localOnly = tracks.filter(tr => tr.participant.isLocal);

  const getResultIcon = () => {
    if (gameResult === 'pass') return <CheckCircle className="w-16 h-16 text-green-500 mb-4" />;
    if (gameResult === 'fail' || gameResult === 'timeout') return <XCircle className="w-16 h-16 text-red-500 mb-4" />;
    return null;
  };
  
  return (
    <motion.div
      className="h-screen flex flex-col bg-[#F0F8FF] font-sans"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        '--lk-participant-media-video-width': '100%'
      } as React.CSSProperties}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#6dc4e8]/10 via-white/50 to-[#6dc4e8]/10 -z-10" />
      
      <header className="flex flex-col bg-white/50 backdrop-blur-sm border-b border-[#6dc4e8]/20">
        <div className="flex items-center justify-between p-4">
          <motion.button 
            onClick={onGameEnd}
            className="p-2 rounded-lg bg-[#6dc4e8]/20 hover:bg-[#6dc4e8]/30 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-6 h-6 text-[#6dc4e8]" />
          </motion.button>
          
          <div className="text-center">
            <h1 className="text-xl font-['BM_HANNA_TTF:Regular',_sans-serif] text-black tracking-wider">
              {gameName}
            </h1>
            <p className="text-sm text-gray-500">{gameDescription}</p>
          </div>
        
          <div className="flex items-center gap-2 text-slate-700">
            <span className="text-lg">⏰</span>
            <motion.span 
              className="font-mono font-bold text-slate-700"
            >
              {formatGameTime(timeLeft)}
            </motion.span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <div className="bg-white/50 backdrop-blur-sm border-b border-[#6dc4e8]/20 p-2 sm:p-3 lg:p-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-base sm:text-lg lg:text-xl text-slate-700 tracking-wider">
              참가자들 ({tracks.length}명)
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
                  <span className="text-slate-500 text-sm sm:text-base lg:text-lg">다른 참가자를 기다리는 중...</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative">
          <motion.div 
            className="relative w-full max-w-4xl aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-xl border-4 border-[#10b981]/30"
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
                className="p-3 rounded-full backdrop-blur-sm transition-colors shadow-lg bg-[#6dc4e8]/80 text-white"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Video className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                onClick={onToggleAudio}
                className="p-3 rounded-full backdrop-blur-sm transition-colors shadow-lg bg-[#6dc4e8]/80 text-white"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Mic className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="absolute top-4 left-4">
              <div className="bg-[#6dc4e8]/90 backdrop-blur-sm rounded-lg px-3 py-1">
                <span className="text-white text-sm font-['BM_HANNA_TTF:Regular',_sans-serif]">
                  내 화면
                </span>
              </div>
            </div>

            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-blue-900/90 backdrop-blur-sm z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="text-center text-white">
                    <div className="animate-spin w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                    <h3 className="text-xl mb-2">AI 분석 중</h3>
                    <p className="text-blue-200">사진을 분석하고 있습니다...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(gameResult === 'pass' || gameResult === 'fail' || gameResult === 'timeout') && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-black/80 z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div 
                    className="bg-white rounded-2xl px-8 py-6 text-center shadow-2xl"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    style={{ 
                      borderColor: gameResult === 'pass' ? '#22C55E' : '#EF4444', 
                      borderWidth: 4 
                    }}
                  >
                    {getResultIcon()}
                    <h2 
                      className={`text-xl font-bold ${gameResult === 'pass' ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {aiMessage}
                    </h2>
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
                     transition={{ 
                       type: "spring",
                       damping: 20,
                       stiffness: 300,
                       duration: 0.6
                     }}
                   >
                     <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl">
                       <p className="text-blue-600 text-base mb-2">제시어</p>
                       <h1 className="text-4xl text-blue-800">
                         {koreanTarget}
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
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border-2 border-[#10b981]/30">
            <p className="text-sm text-gray-700 mb-1 text-center">
              제시어: <span className="font-medium text-blue-600">{koreanTarget}</span>
            </p>
            <p className="text-xs text-gray-600 text-center">
              물건을 카메라에 보여주고 버튼을 클릭하세요!
            </p>
          </div>
          
          <motion.button
            onClick={analyzeFrame}
            className={`px-8 py-4 rounded-full shadow-lg flex items-center gap-3 ${
              finalized || isAnalyzing
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-[#10b981] hover:bg-[#059669]'
            } text-white`}
            whileHover={!finalized && !isAnalyzing ? { scale: 1.05 } : {}}
            whileTap={!finalized && !isAnalyzing ? { scale: 0.95 } : {}}
            disabled={isAnalyzing || finalized}
          >
            <Camera className="w-6 h-6" />
            <span className="text-lg font-bold">
              {isAnalyzing ? '분석 중...' : finalized ? '게임 종료!' : '사진 찍기'}
            </span>
          </motion.button>
        </div>
      )}

      {!isPortrait && (
        <div className="p-4 text-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border-2 border-[#10b981]/30">
            <p className="text-sm text-gray-700 mb-1">
              제시어: <span className="font-medium text-blue-600">{koreanTarget}</span>
            </p>
            <p className="text-sm text-gray-600">
              물건을 카메라에 보여주고 스페이스바를 눌러 사진을 찍고 AI 분석을 시작하세요!
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
