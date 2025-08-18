// src/components/achievements/AchievementCard.tsx
import { motion } from "framer-motion";
import { Trophy, Lock } from "lucide-react";
import type { AchievementCore } from "@/app/stores/achievementStore";

type Props = {
  achievement: AchievementCore;
  index?: number;
  onClick?: () => void;
  onEquip?: () => void;
  isEquipped?: boolean;
};

export function AchievementCard({
  achievement,
  index = 0,
  onClick,
  onEquip,
  isEquipped,
}: Props) {
  const completed = achievement.hasAchievement;
  const isBadge = achievement.item.itemCategory.categoryCode === "BAD";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.25 }}
      className={`group relative text-left rounded-2xl border shadow-sm
        ${completed ? "border-border/60 bg-card" : "border-border/50 bg-muted/20"}
        w-full min-h-[120px] overflow-hidden`}
    >
      <button
        onClick={onClick}
        className="flex w-full items-stretch gap-4 p-4"
        disabled={!onClick}
      >
        {/* 아이콘 */}
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-xl ring-1 ring-black/5 flex-shrink-0 mt-0.5
            ${completed ? "bg-gradient-to-tr from-amber-400/20 to-yellow-300/10" : "bg-gradient-to-tr from-slate-400/15 to-slate-200/10 grayscale"}`}
        >
          {completed ? <Trophy className="h-6 w-6 text-amber-500" /> : <Lock className="h-6 w-6 text-slate-400" />}
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-base sm:text-[15px] font-semibold">
            {achievement.name}
          </h3>
          <p className="truncate text-s text-muted-foreground">
            {completed ? "획득됨" : "잠금 해제 필요"}
          </p>
          <p className={`mt-2 text-sm ${!completed ? "opacity-80" : ""}`}>
            {achievement.exp}
          </p>
        </div>

        {/* 보상 + 장착 버튼 */}
        <div className="w-[200px] flex-shrink-0 flex flex-col">
          <div className="h-full rounded-xl border border-border/40 bg-background/50 px-3 py-2 flex-1 flex flex-col justify-center">
            <div className="text-s text-muted-foreground">보상</div>
            <div className="mt-1 text-m">
              {achievement.item.itemCategory.name} · {achievement.item.name}
            </div>
          </div>

          {/* 뱃지 타입이고, 획득한 업적일 때만 장착 버튼 표시 */}
          {isBadge && completed && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation(); // 카드 전체 클릭 방지
                onEquip?.();
              }}
              disabled={isEquipped}
              className={`mt-2 w-full py-1.5 px-3 rounded-lg text-sm font-semibold transition-colors
                ${isEquipped
                  ? "bg-green-600 text-white cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
                }`}
              whileTap={{ scale: 0.95 }}
            >
              {isEquipped ? "장착됨" : "장착"}
            </motion.button>
          )}
        </div>
      </button>
    </motion.div>
  );
}