import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2 } from "lucide-react";
import type { AchievementCore } from "@/app/stores/achievementStore";

interface Props {
  achievement: AchievementCore | null;
  onClose: () => void;
}

export function AchievementModal({ achievement, onClose }: Props) {
  if (!achievement) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative bg-card rounded-xl shadow-2xl border border-border/50 w-full max-w-md p-6"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={24} />
          </button>

          <div className="text-center">
            <div className="text-6xl mb-4">{"🏆"}</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {achievement.name}
            </h2>
            <p className="text-muted-foreground mb-4">{achievement.exp} EXP</p>
            {achievement.hasAchievement && (
              <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-sm font-semibold">
                <CheckCircle2 size={16} />
                <span>달성 완료</span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="font-bold text-lg mb-2">보상</h3>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-center text-foreground">
                {achievement.item.name}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}