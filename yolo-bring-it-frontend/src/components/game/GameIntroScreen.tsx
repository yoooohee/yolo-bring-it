import { motion } from "framer-motion";
import type { GameData } from "@/shared/types/game";

interface GameCountdownScreenProps {
  gameData: GameData;
}

export function GameIntroScreen({ gameData }: GameCountdownScreenProps) {
  return (
    <motion.div
      className="h-screen flex flex-col bg-[#F0F8FF] font-sans items-center justify-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#6dc4e8]/10 via-white/50 to-[#6dc4e8]/10 -z-10" />
      
      {/* 라운드 정보 */}
      <motion.div 
        className="text-center mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className="text-2xl font-['BM_HANNA_TTF:Regular',_sans-serif] text-[#6dc4e8] tracking-wider mb-2">
          라운드 {gameData.currentRound}
        </h1>
        <h2 className="text-3xl font-['BM_HANNA_TTF:Regular',_sans-serif] text-black tracking-wider mb-2">
          {gameData.gameName}
        </h2>
        <p className="text-lg text-slate-600">{gameData.gameDescription}</p>
      </motion.div>

      {/* 게임 설명 */}
      <motion.div 
        className="text-center mt-8 max-w-md"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-slate-600">{gameData.gameDescription}</p>
      </motion.div>
    </motion.div>
  );
}
