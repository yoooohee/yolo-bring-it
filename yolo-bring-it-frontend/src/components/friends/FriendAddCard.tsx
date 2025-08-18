import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { softCard, btnPrimary } from "./friendsTheme";

interface AddFriendCardProps {
  memberId: number;
  nickname: string;
  avatarUrl?: string; // ✅ avatarUrl은 옵셔널로 변경
  level?: number;     // ✅ level은 옵셔널로 변경
  mutualFriends?: number; // ✅ mutualFriends는 옵셔널로 변경
  onSendRequest: (memberId: number) => void;
  disabled?: boolean;
  requested?: boolean;
}

export default function AddFriendCard({
  memberId,
  nickname,
  avatarUrl,
  level,
  onSendRequest,
  requested = false,
  disabled = false,
}: AddFriendCardProps) {
  const defaultAvatar = "https://pub-1b87520b13004863b6faad8458f37850.r2.dev/%EB%8F%8C_%EA%B8%B0%EB%B3%B8.png"; // ✅ 기본 아바타 이미지 경로 설정
  const avatarSrc = avatarUrl && avatarUrl.trim().length > 0 ? avatarUrl : defaultAvatar;
  console.log("친구 정보", AddFriendCard)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.5 }}
      className={`${softCard} p-6`}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <img src={avatarSrc} alt={nickname} className="w-16 h-16 rounded-full object-cover border-2 border-card" />
          <div className="flex flex-col gap-1">
            <h3 className="game-text text-foreground text-xl font-medium leading-snug">{nickname}</h3>
            <div className="text-muted-foreground text-sm">
              레벨 {level ?? '?'}{" "} {/* ✅ 레벨이 없으면 '?'로 표시 */}
            </div>
          </div>
        </div>

        {requested ? (
          <motion.div className="bg-muted text-muted-foreground px-4 py-2 text-sm rounded-lg game-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            요청됨
          </motion.div>
        ) : (
          <motion.button className={`${btnPrimary} px-4 py-2 text-sm font-medium`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onSendRequest(memberId)} disabled={disabled}>
            <UserPlus className="w-4 h-4 mr-2" /> 친구 추가
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}