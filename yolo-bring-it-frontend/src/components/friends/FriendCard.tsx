// src/components/friends/FriendCard.tsx
import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, User as UserIcon, MoreVertical, UserMinus, UserX } from "lucide-react";

export interface FriendCardProps {
  // 표시
  memberId: number;
  nickname: string;
  avatarUrl?: string;
  level?: number;
  status?: "online" | "offline" | "playing";
  onChat?: (id: number) => void;
  onRemove?: (id: number) => void;
  onBlock?: (id: number) => void;
  onViewProfile?: (id: number) => void;
}

const DEFAULT_AVATAR_URL = "https://pub-1b87520b13004863b6faad8458f37850.r2.dev/%EB%8F%8C_%EA%B8%B0%EB%B3%B8.png"; // ✅ 기본 아바타 이미지 URL

export const FriendCard = memo(function FriendCard({
  memberId,
  nickname,
  avatarUrl,
  level = 0,
  status = "offline",
  onChat,
  onViewProfile, // ⭐ NEW
  onRemove,
  onBlock,
}: FriendCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ avatarUrl이 유효하지 않을 때 기본 이미지 사용
  const avatarSrc = avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : DEFAULT_AVATAR_URL;

  return (
    <motion.div
      className="flex items-center justify-between rounded-2xl border px-4 py-3 bg-white"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      {/* 좌측 정보 */}
      <div className="flex items-center gap-4">
        <div className="relative h-12 w-12 overflow-hidden rounded-full bg-gray-200">
          {/* ✅ avatarSrc 변수를 사용하여 이미지 표시 */}
          <img src={avatarSrc} alt={nickname} className="h-full w-full object-cover" />
          {/* 이미지가 없을 때의 대체 콘텐츠는 제거 (img src에 기본 이미지 지정했으므로) */}
        </div>
        <div>
          <div className="font-medium">{nickname || "알 수 없음"}</div>
          <div className="text-xs text-muted-foreground">
            레벨 {level ?? 0} · {status === "online" ? "온라인" : status === "playing" ? "플레이 중" : "오프라인"}
          </div>
        </div>
      </div>

      {/* 우측 액션 */}
      <div className="flex items-center gap-2">
        {/* ⭐ NEW: 프로필 버튼 (채팅 왼쪽) */}
        <motion.button
          onClick={() => onViewProfile?.(memberId)}
          className="grid h-9 w-9 place-items-center rounded-lg bg-gray-100 hover:bg-gray-200"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="프로필 보기"
        >
          <UserIcon className="h-5 w-5" />
        </motion.button>

        {/* 기존: 채팅 버튼 */}
        <motion.button
          onClick={() => onChat?.(memberId)}
          className="grid h-9 w-9 place-items-center rounded-lg bg-sky-100 hover:bg-sky-200"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="채팅"
        >
          <MessageCircle className="h-5 w-5" />
        </motion.button>

        {/* 기타 메뉴 */}
        <div className="relative">
          <motion.button 
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-gray-100" 
            title="더보기"
            onClick={() => setMenuOpen(prev => !prev)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MoreVertical className="h-5 w-5" />
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="absolute right-0 top-full mt-2 w-40 bg-white rounded-lg shadow-lg border border-border p-1 z-10"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <button
                  onClick={() => {
                    onRemove?.(memberId);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left text-yellow-600 hover:bg-yellow-50 transition-colors duration-200 flex items-center px-4 py-2 gap-2 text-sm"
                >
                  <UserMinus className="w-4 h-4" />
                  친구 삭제
                </button>
                <button
                  onClick={() => {
                    onBlock?.(memberId);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left text-red-600 hover:bg-red-50 transition-colors duration-200 flex items-center px-4 py-2 gap-2 text-sm"
                >
                  <UserX className="w-4 h-4" />
                  차단하기
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});