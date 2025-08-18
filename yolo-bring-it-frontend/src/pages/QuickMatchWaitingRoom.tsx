import { motion } from "framer-motion";
import {
  ArrowLeft,
  Send,
  UserPlus,
  Crown,
  MessageSquare,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "lucide-react";
import type { Player, ChatMessage } from "@/shared/types/game";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { useGameWaitingRoomLogic } from "@/shared/hooks/useGameWaitingRoomLogic";
import { useRef, useEffect } from "react";


interface QuickMatchWaitingRoomProps {
  onStartGame: (players: Player[], roomUid: number) => void;
  onBack: () => void;
}

export function QuickMatchWaitingRoom({ onStartGame, onBack }: QuickMatchWaitingRoomProps) {
  const {
    players,
    roomId,
    message,
    setMessage,
    messages,
    roomLeaderId,
    localVideoRef,
    isMicEnabled,
    isWebcamEnabled,
    handleToggleMic,
    handleToggleWebcam,
    handleSendMessage,
    handleKeyPress,
    handleToggleReady,
    currentUser,
    handleLeaveRoom,
  } = useGameWaitingRoomLogic({ gameMode: "quick", onStartGame, onBack: onBack });

  useEffect(() => {
    if (roomId) {
      console.log(`[QuickMatchWaitingRoom] Room ID: ${roomId}`);
    }
  }, [roomId]);

  return (
    <div className="h-screen w-full text-slate-800 relative overflow-hidden flex flex-col bg-[#F0F8FF] font-sans">
      <Header onBack={handleLeaveRoom} isLocked={!roomId} />
      
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 pt-20">
        <div className="w-full flex flex-row items-stretch justify-center gap-8 max-h-[650px] lg:max-h-[700px] xl:max-h-[750px]">
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <PlayerGrid 
              players={players} 
              roomLeaderId={roomLeaderId}
              isWebcamEnabled={isWebcamEnabled}
              isMicEnabled={isMicEnabled}
              onToggleWebcam={handleToggleWebcam}
              onToggleMic={handleToggleMic}
              localVideoRef={localVideoRef}
            />
          </div>
          <div className="flex-shrink-0 w-[340px] lg:w-96 xl:w-[400px]">
             {/* SidePanel for quick match doesn't need friend list */}
            <QuickMatchSidePanel
              messages={messages}
              message={message}
              setMessage={setMessage}
              onSendMessage={handleSendMessage}
              onKeyPress={handleKeyPress}
              onToggleReady={handleToggleReady}
              currentUser={currentUser}
              isLocked={!roomId}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function QuickMatchSidePanel({ messages, message, setMessage, onSendMessage, onKeyPress, onToggleReady, currentUser, isLocked }: any) {
  return (
    <Card className="w-full h-full bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-xl flex flex-col rounded-2xl">
      <div className="p-2">
        <div className="grid h-auto w-full grid-cols-1 rounded-lg bg-slate-200/80 p-1">
          <div className="font-['BM_HANNA_TTF:Regular',_sans-serif] bg-[#6dc4e8] text-white rounded-md py-2 text-base flex items-center justify-center">
            <MessageSquare className="w-5 h-5 mr-2" /> 채팅
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-slate-100/50 rounded-b-lg">
        <ChatPanel messages={messages} message={message} setMessage={setMessage} onSendMessage={onSendMessage} onKeyPress={onKeyPress} currentUserNickname={currentUser?.name} />
      </div>
      <div className="p-4 border-t border-slate-200/80 flex-shrink-0 space-y-2">
        <Button size="lg" variant={currentUser?.isReady ? "destructive" : "default"} className={`w-full font-bold text-lg rounded-xl h-12 transition-all ${currentUser?.isReady ? 'bg-red-500 hover:bg-red-700' : 'bg-[#6dc4e8] hover:bg-[#5ab4d8]'} text-white`} onClick={onToggleReady} disabled={isLocked}>
          {currentUser?.isReady ? "준비 취소" : "준비 완료"}
        </Button>
        <p className="text-xs text-center text-slate-500 mt-2">6명이 모이면 자동으로 시작됩니다.</p>
      </div>
    </Card>
  );
}

// Re-usable sub-components from GameWaitingRoom
function Header({ onBack, isLocked }: { onBack: () => void; isLocked: boolean }) {
  return (
    <motion.button
      className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 flex items-center gap-2 rounded-xl bg-card/60 px-3 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-card/80 disabled:pointer-events-none disabled:opacity-50"
      onClick={onBack}
      disabled={isLocked}
    >
      <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-sm sm:text-base hidden sm:inline">나가기</span>
    </motion.button>
  );
}
function PlayerSlot({ player, isLeader, isCurrentUser, isWebcamEnabled, isMicEnabled, onToggleWebcam, onToggleMic, localVideoRef }: any) {
    return (
    <motion.div
      className={`relative aspect-square rounded-2xl shadow-lg flex items-center justify-center transition-all duration-300 ${
        player
          ? isCurrentUser
            ? "bg-slate-900"
            : "bg-white/80 backdrop-blur-md"
          : "border-2 border-dashed border-[#6dc4e8]/50"
      } ${
        isCurrentUser
          ? "ring-4 ring-offset-2 ring-offset-[#6dc4e8]/30 ring-[#6dc4e8]"
          : ""
      }`}
      variants={{
        hidden: { opacity: 0, scale: 0.8 },
        show: { opacity: 1, scale: 1 },
      }}
    >
      {player ? (
        <>
          {isLeader && (
            <motion.div
              className="absolute top-2 right-2 p-1 bg-yellow-400/90 rounded-full shadow z-20"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            >
              <Crown className="w-3 h-3 md:w-4 md:h-4 text-white" />
            </motion.div>
          )}

          {isCurrentUser ? (
            <>
              <div className="absolute inset-0 bg-black rounded-2xl overflow-hidden">
                {isWebcamEnabled && localVideoRef ? (
                  <video
                    ref={localVideoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <VideoOff className="w-12 h-12 text-white/60" />
                  </div>
                )}
              </div>

              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-10">
                <motion.button
                  onClick={onToggleWebcam}
                  className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-white ${
                    isWebcamEnabled ? 'bg-[#6dc4e8]/80' : 'bg-red-500/80'
                  }`}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                >
                  {isWebcamEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                </motion.button>
                <motion.button
                  onClick={onToggleMic}
                  className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-white ${
                    isMicEnabled ? 'bg-[#6dc4e8]/80' : 'bg-red-500/80'
                  }`}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                >
                  {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                </motion.button>
              </div>

              <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 text-center z-10">
                <p className="font-bold text-white truncate drop-shadow-lg text-sm">{player.name}</p>
                <div className={`mt-1 px-2.5 py-1 text-xs font-semibold rounded-full inline-block ${player.isReady ? "bg-[#6dc4e8] text-white" : "bg-slate-400/90 text-white"}`}>
                  {player.isReady ? "준비완료" : "대기중"}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                <Avatar className="w-16 h-16 md:w-20 md:h-20 mb-2 border-4 border-white/80 shadow-md">
                  <AvatarImage src={player.avatar} alt={player.name} />
                  <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/50 to-transparent rounded-b-2xl text-center z-10">
                <p className="text-sm md:text-base font-bold text-white truncate drop-shadow-lg">{player.name}</p>
                <div className={`mt-1 px-2.5 py-1 text-xs font-semibold rounded-full inline-block ${player.isReady ? "bg-[#6dc4e8] text-white" : "bg-slate-400/90 text-white"}`}>
                  {player.isReady ? "준비완료" : "대기중"}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center text-[#6dc4e8]/70">
          <UserPlus size={40} className="mb-2" />
          <span className="font-semibold text-sm">빈 슬롯</span>
        </div>
      )}
    </motion.div>
  );
}
function PlayerGrid({ players, roomLeaderId, isWebcamEnabled, isMicEnabled, onToggleWebcam, onToggleMic, localVideoRef }: any) {
  const slots = Array(6).fill(null);
  players.forEach((player: Player, index: number) => {
    slots[index] = player;
  });

  return (
    <div className="w-full mx-auto">
      <motion.div
        className="grid grid-cols-3 gap-4 md:gap-6 lg:gap-8"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        initial="hidden"
        animate="show"
      >
        {slots.map((player, index) => {
          const isCurrentUser = player ? player.isCurrentUser || false : false;
          return (
            <PlayerSlot
              key={player ? player.id : `empty-${index}`}
              player={player}
              isLeader={player ? player.id === roomLeaderId : false}
              isCurrentUser={isCurrentUser}
              {...(isCurrentUser && { isWebcamEnabled, isMicEnabled, onToggleWebcam, onToggleMic, localVideoRef })}
            />
          );
        })}
      </motion.div>
    </div>
  );
}
function ChatPanel({ messages, message, setMessage, onSendMessage, onKeyPress, currentUserNickname }: any) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-full w-full flex flex-col bg-transparent">
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        {messages.map((msg: ChatMessage) => (
          <div
            key={msg.id}
            className={`flex flex-col text-sm w-full ${
              msg.type === "system"
                ? "items-center"
                : msg.user === currentUserNickname
                ? "items-end"
                : "items-start"
            }`}
          >
            {msg.type === "system" ? (
              <span className="text-xs text-slate-500 bg-slate-200/80 px-2 py-1 rounded-full">{msg.message}</span>
            ) : (
              <div className={`p-3 rounded-lg max-w-[85%] ${msg.user === currentUserNickname ? "bg-[#6dc4e8] text-white" : "bg-slate-200 text-slate-800"}`}>
                <div className="font-bold text-sm mb-1">{msg.user}</div>
                <p className="text-sm break-words">{msg.message}</p>
                <div className="text-xs text-slate-500/80 mt-1.5 text-right">{msg.timestamp}</div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-slate-200/80 flex-shrink-0">
        <div className="flex gap-3">
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={onKeyPress} placeholder="메시지를 입력하세요" className="flex-1 bg-slate-100 border border-slate-300/80 rounded-lg px-4 py-2 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6dc4e8] transition-all" />
          <Button onClick={onSendMessage} disabled={!message.trim()} className="bg-[#6dc4e8] hover:bg-[#57b3d9] text-white font-bold transition-colors">
            <Send size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
