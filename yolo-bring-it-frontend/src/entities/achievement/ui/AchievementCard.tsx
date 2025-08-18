import { CheckCircle2, Award, Gift } from "lucide-react";

import { AchievementCore } from "@/app/stores/achievementStore";

interface Props {
  achievement: AchievementCore;
  onSelect: (achievement: AchievementCore) => void;
}

export const AchievementCard = ({ achievement, onSelect }: Props) => {
  if (!achievement) return null;

  return (
    <div
      className={`relative p-4 rounded-lg shadow-md cursor-pointer transition-all duration-300 ${
        achievement.hasAchievement ? "bg-green-100 border-green-300" : "bg-gray-100 border-gray-300"
      }`}
      onClick={() => onSelect(achievement)}
    >
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          {achievement.hasAchievement ? (
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          ) : (
            <Award className="w-8 h-8 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {achievement.name}
          </p>
          <p className="text-sm text-gray-500">
            {achievement.hasAchievement ? "달성 완료" : "미달성"}
          </p>
        </div>
        <div className="flex items-center text-sm text-gray-700">
          <Gift className="w-4 h-4 mr-1 text-yellow-500" />
          <span>{achievement.exp} EXP</span>
        </div>
      </div>
    </div>
  );
};