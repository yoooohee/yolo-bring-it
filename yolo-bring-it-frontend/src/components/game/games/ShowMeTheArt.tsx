import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/shared/ui/button";
import { Palette, RotateCcw, Brush, Users, Camera } from "lucide-react";
import { useIsPortrait } from "@/shared/ui/use-window-size";
import apiClient from "@/shared/services/api";
import { useUserLoginStore } from '@/app/stores/userStore';
import type { GameData } from "@/shared/types/game";
import { Room, Track } from 'livekit-client';
import { useTracks, ParticipantTile } from '@livekit/components-react';

interface ShowMeTheArtProps {
    timeLeft: number;
    gameData: GameData;
    room: Room;
    onGameComplete?: (success: boolean) => void;
    onGameEnd?: () => void;
}


export const ShowMeTheArt: React.FC<ShowMeTheArtProps> = ({
    timeLeft,
    gameData,
    room,
    onGameComplete,
    onGameEnd,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentColor, setCurrentColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(3);
    const [showPrompt, setShowPrompt] = useState(false);
    const [promptVisible, setPromptVisible] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [gameResult, setGameResult] = useState<'pending' | 'pass' | 'fail' | 'timeout'>('pending');
    const [aiResults, setAiResults] = useState<string>("");
    const [isCapturing, setIsCapturing] = useState(false);
    
    const { userData } = useUserLoginStore();
    
    const {
        gameName,
        gameDescription,
        keywords,
        roomId,
        roundIdx,
        gameCode,
    } = gameData;

    const targetPictureKO = keywords?.ko;

    const colors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const isPortrait = useIsPortrait();

    const tracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: true }],
        { onlySubscribed: false },
    );
    const remoteParticipantsTracks = tracks.filter(tr => !tr.participant.isLocal);
    const localParticipantTrack = tracks.find(tr => tr.participant.isLocal);

    const onToggleVideo = async () => {
        if (room?.localParticipant) {
            await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled);
        }
    };
    
    const onToggleAudio = async () => {
        if (room?.localParticipant) {
            await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
        }
    };

    const initializeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;

        const resize = () => {
            const rect = parent.getBoundingClientRect();
            canvas.width = Math.max(1, Math.floor(rect.width));
            canvas.height = Math.max(1, Math.floor(rect.height));
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        };

        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    const showPromptAndStartGame = useCallback(() => {
        setShowPrompt(true);
        setTimeout(() => setPromptVisible(true), 100);
        setTimeout(() => {
            setPromptVisible(false);
            setTimeout(() => {
                setShowPrompt(false);
                setGameStarted(true);
            }, 300);
        }, 2000);
    }, []);

    useEffect(() => {
        if (keywords) {
            initializeCanvas();
            showPromptAndStartGame();
        }
    }, [keywords, initializeCanvas, showPromptAndStartGame]);

    useEffect(() => {
        if (timeLeft <= 0 && gameResult === 'pending') {
            setGameResult('timeout');
            setAiResults('시간 초과! 그림을 완성하지 못했어요.');
            onGameComplete?.(false);
        }
    }, [timeLeft, gameResult, onGameComplete]);


    const callJudgeApi = useCallback(async (blob: Blob) => {
        if (!userData || !keywords) {
            console.error('사용자 데이터 또는 제시어가 없습니다.');
            return;
        }
    
        try {
            const formData = new FormData();
            formData.append('image', blob, 'drawing.png');
            formData.append("roomId", String(roomId));
            formData.append("roundIdx", String(roundIdx));
            formData.append("gameCode", String(gameCode));
            formData.append("userId", userData.memberUid.toString());
            formData.append(
                "targetPicture",
                keywords.en ?? ''
              );

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

            const result = response.data.data;
            console.log(result);
            const isCorrect = result.result === "PASS";
            
            if (isCorrect) {
                const similarity = parseFloat(result.similarity_percent);
                setAiResults(`'${keywords.ko}' 그림 그리기에 성공했습니다! (유사도: ${similarity.toFixed(2)}%)`);
                setGameResult('pass');
                onGameComplete?.(true);
            } else {
                setAiResults(`'${keywords.ko}' 그림과 달라요. 다시 시도해보세요!`);
                setGameResult('fail'); 
                setTimeout(() => setGameResult('pending'), 2000); // 2초 후 다시 시도 가능
            }

        } catch (error) {
            console.error('API 호출 실패:', error);
            setAiResults('그림 분석 중 오류가 발생했습니다.');
            setGameResult('fail');
            setTimeout(() => setGameResult('pending'), 2000);
        } finally {
            setIsCapturing(false);
            setIsSubmitting(false);
        }
    }, [gameCode, roundIdx, roomId, keywords, userData, onGameComplete]);

    const captureDrawing = useCallback(async () => {
        if (!gameStarted || isSubmitting || isCapturing || gameResult !== 'pending') return;
        setIsCapturing(true);

        const canvas = canvasRef.current;
        if (!canvas) {
            setIsCapturing(false);
            return;
        }

        canvas.toBlob(async (blob) => {
            if (!blob) {
                setIsCapturing(false);
                return;
            }
            await callJudgeApi(blob);
        }, 'image/png');
    }, [gameStarted, isSubmitting, isCapturing, callJudgeApi, gameResult]);

    const startDrawing = (e: React.MouseEvent) => {
        if (!gameStarted || isSubmitting || gameResult !== 'pending') return;
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                ctx.beginPath();
                ctx.moveTo(x, y);
            }
        }
        draw(e);
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !gameStarted || isSubmitting || gameResult !== 'pending') return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                ctx.lineWidth = brushSize;
                ctx.lineCap = 'round';
                ctx.strokeStyle = currentColor;
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, y);
            }
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.beginPath();
        }
    };

    const clearCanvas = () => {
        if(gameResult !== 'pending') return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const submitDrawing = () => {
        if(gameResult !== 'pending') return;
        setIsSubmitting(true);
        captureDrawing();
    };

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.code === 'Space' && gameStarted && !isSubmitting && !isCapturing && gameResult === 'pending') {
                e.preventDefault();
                captureDrawing();
            }
        };

        if (gameStarted) document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [gameStarted, isSubmitting, isCapturing, captureDrawing, gameResult]);

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-orange-50 to-orange-100 font-sans">
            {/* 헤더 */}
            <header className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-orange-200 p-3 shadow-sm">
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <div>
                        <h2 className="text-xl font-bold text-orange-800">{gameName}</h2>
                        <p className="text-sm text-orange-600">{gameDescription}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-bold text-orange-800">남은 시간: {Math.round(timeLeft)}초</div>
                        <div className="text-sm text-orange-600">AI가 그림을 평가합니다</div>
                    </div>
                </div>
            </header>

            {/* 메인 콘텐츠 영역 */}
            <main className="flex-grow flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
                
                {/* 왼쪽 사이드바 (참가자) */}
                <aside className="w-full md:w-64 flex-shrink-0 flex flex-row md:flex-col gap-3 overflow-y-auto p-2 bg-white/60 rounded-lg shadow-inner">
                    <h3 className="font-bold text-lg text-green-700 tracking-wider mb-2 hidden md:block">
                        참가자들 ({room.remoteParticipants.size + 1}명)
                    </h3>
                    {remoteParticipantsTracks.length > 0 ? (
                        remoteParticipantsTracks.map((trackRef) => (
                            <motion.div
                                key={trackRef.participant.sid}
                                className="relative w-36 h-28 sm:w-44 sm:h-32 md:w-full md:h-auto md:aspect-video bg-white/80 rounded-lg overflow-hidden flex-shrink-0 shadow-lg border-2 border-green-300"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                            >
                                <ParticipantTile trackRef={trackRef} />
                                <div className="absolute bottom-1 left-1 right-1">
                                    <div className="bg-green-500/90 backdrop-blur-sm rounded px-2 py-1">
                                        <span className="text-white text-sm font-bold truncate block text-center">
                                            {trackRef.participant.identity}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <span className="text-green-500 text-sm">다른 참가자를 기다리는 중...</span>
                        </div>
                    )}
                </aside>

                {/* 중앙 그리기 영역 */}
                <div className="flex-grow relative bg-white rounded-xl shadow-lg overflow-hidden border-4 border-orange-200">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        className="w-full h-full cursor-crosshair"
                    />

                    <AnimatePresence>
                        {showPrompt && keywords && (
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
                                        y: promptVisible ? 0 : -100,
                                        opacity: promptVisible ? 1 : 0,
                                        scale: promptVisible ? 1 : 0.8
                                    }}
                                    transition={{ type: "spring", damping: 20, stiffness: 300, duration: 0.6 }}
                                >
                                    <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl">
                                        <p className="text-orange-600 text-base mb-2">그림 주제</p>
                                        <h1 className="text-4xl md:text-6xl text-orange-800">
                                            {targetPictureKO}
                                        </h1>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {(isSubmitting || isCapturing) && (
                            <motion.div className="absolute inset-0 flex items-center justify-center bg-orange-900/90 backdrop-blur-sm z-30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <div className="text-center text-white">
                                    <div className="animate-spin w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                                    <h3 className="text-xl mb-2">AI 평가 중</h3>
                                    <p className="text-orange-200">그림을 분석하고 있습니다...</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <AnimatePresence>
                        {gameResult !== 'pending' && !isSubmitting && !isCapturing && (
                            <motion.div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <motion.div className="text-center" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20, stiffness: 300 }}>
                                    <div className={`bg-white rounded-2xl px-8 py-6 shadow-2xl border-4 ${gameResult === 'pass' ? 'border-green-500' : 'border-red-500'}`}>
                                        <h2 className={`text-3xl font-bold mb-4 ${gameResult === 'pass' ? 'text-green-600' : 'text-red-600'}`}>🎨 {gameResult === 'pass' ? '성공!' : '실패!'}</h2>
                                        <p className="text-lg text-gray-700 mb-2">{aiResults}</p>
                                        <p className="text-sm text-gray-500">
                                            {gameResult === 'pass' || gameResult === 'timeout' ? '다른 참가자들을 기다리고 있습니다...' : '다시 시도해주세요!'}
                                        </p>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>

                <aside className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4">
                    <div className="relative w-full aspect-video bg-white/60 rounded-lg shadow-inner overflow-hidden">
                        {localParticipantTrack && <ParticipantTile trackRef={localParticipantTrack} />}
                        <div className="absolute top-2 left-2 z-10">
                            <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                <Brush className="w-4 h-4" />
                                나의 모습
                            </div>
                        </div>
                    </div>
                    <div className="flex-grow flex flex-col gap-4 p-3 bg-white/60 rounded-lg shadow-inner">
                        <div className="flex items-center gap-2">
                            <Palette className="w-5 h-5 text-orange-600 flex-shrink-0" />
                            <div className="flex flex-wrap gap-2">
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setCurrentColor(color)}
                                        className={`w-7 h-7 rounded-full border-2 transition-all ${currentColor === color ? 'border-orange-500 scale-110' : 'border-gray-300'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-orange-600 text-sm whitespace-nowrap">브러시:</span>
                            <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full" />
                            <span className="text-orange-500 text-sm w-8 text-right">{brushSize}px</span>
                        </div>
                         <Button
                            onClick={clearCanvas}
                            variant="outline"
                            size="sm"
                            disabled={gameResult !== 'pending'}
                            className="w-full border-red-300 text-red-600 hover:bg-red-50 disabled:bg-gray-200"
                        >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            전체 지우기
                        </Button>
                    </div>
                </aside>

            </main>

            <footer className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-t border-orange-200 p-3">
                <div className="flex items-center justify-center gap-6 max-w-2xl mx-auto">
                    {gameStarted && (
                        <Button
                            onClick={submitDrawing}
                            disabled={isSubmitting || isCapturing || gameResult !== 'pending'}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-lg rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-200 disabled:bg-gray-400"
                        >
                            <Camera className="w-6 h-6 mr-2 animate-pulse" />
                            {isCapturing ? '제출 중...' : isPortrait ? '그림 제출' : '스페이스바로 그림 제출'}
                        </Button>
                    )}
                    <p className="text-orange-600 text-sm hidden md:block">
                        💡 스페이스바를 누르거나 버튼을 클릭하여 그림을 제출하세요!
                    </p>
                </div>
            </footer>
        </div>
    );
};
