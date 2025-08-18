import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import AddFriendCard from "@/components/friends/FriendAddCard";
import { useFriendStore } from "@/app/stores/friendStore";
import { useUserLoginStore } from "@/app/stores/userStore";
import { toast } from "sonner";
import { authService } from "@/shared/services/authService";
import apiClient from "@/shared/services/api"; // ✅ axios 인스턴스 import
import { inputBase, touchTarget } from "./friendsTheme";

interface MemberResult {
   memberUid: number;
   nickname: string;
}

// ✅ 확장된 유저 정보 타입
interface ExtendedMemberResult {
   memberUid: number;
   nickname: string;
   avatarUrl: string;
   level: number;
}

export default function AddFriendTab() {
   const [searchQuery, setSearchQuery] = useState("");
   const [results, setResults] = useState<ExtendedMemberResult[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");
   const { addRequest, friendRequests } = useFriendStore();

  const myUid = useUserLoginStore((s) => s.userData?.memberUid);

  const requestedIds = useMemo(() => new Set(friendRequests.map((r: any) => r.memberId)), [friendRequests]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(() => {
      setLoading(true);
      setError("");

      authService.searchUsers(searchQuery)
        .then(async (resData) => { // ✅ async/await 사용
          const searchResults: MemberResult[] = Array.isArray(resData) ? resData : resData.data;

          // ✅ 유저 ID 목록 추출
          const memberUids = searchResults.map(user => user.memberUid);

          // ✅ Promise.all을 사용해 상세 정보 병렬로 가져오기
          const detailedResults = await Promise.all(
            memberUids.map(uid => 
              apiClient.get(`https://i13c207.p.ssafy.io/api/v1/users/users/${uid}`)
                .then(res => res.data?.data)
                .catch(err => {
                console.error(`Failed to fetch details for user ${uid}:`, err);
                  return null; // 실패 시 null 반환
                })
            )
          );

          // ✅ 검색 결과와 상세 정보를 병합
          const mergedResults = searchResults.map((user, index) => {
            const details = detailedResults[index];
            return {
              memberUid: user.memberUid,
              nickname: details?.nickname ?? user.nickname,
              avatarUrl: details?.char2dpath ?? "", // ✅ `char2dpath`로 아바타 URL 설정
              level: details?.lev ?? 0, // ✅ `lev`로 레벨 설정
            };
          }).filter(user => user.memberUid !== myUid); // ✅ 여기서도 필터링

          setResults(mergedResults); // ✅ 병합된 결과로 상태 업데이트
          
        })
        .catch((err) => {
          console.error("검색 실패:", err);
          setError(err.response?.data?.message || err.message);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, myUid]);

  const handleSendRequest = async (receiverId: number) => {
    try {
      setLoading(true);
      await authService.sendFriendRequest(receiverId);

      const sentUser = results.find((u) => u.memberUid === receiverId);
      if (sentUser) {
        
        addRequest({
          id: Date.now(),
          memberId: sentUser.memberUid,
          nickname: sentUser.nickname,
          avatarUrl: sentUser.avatarUrl,
          level: sentUser.level,
          mutualFriends: 0,
          sentAt: new Date().toISOString(),
        });
      }
      setResults((prev) => prev.filter((u) => u.memberUid !== receiverId));
      toast.success(`${sentUser?.nickname}님께 친구 요청을 보냈어요!`);
    } catch (err: any) {
      toast.error(err?.message ?? "요청 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };
  
  const filteredResults = useMemo(() => {
    if (!myUid) return results;
    return results.filter(user => user.memberUid !== myUid);
  }, [results, myUid]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      {/* 검색 바 */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <input
          type="text"
          placeholder="유저 닉네임 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputBase} px-12 py-4 text-base ${touchTarget}`}
        />
      </div>

      {/* 결과 리스트 */}
      <div className="flex flex-col gap-6">
        {loading ? (
          <p className="text-muted-foreground text-sm text-center">검색 중...</p>
        ) : error ? (
          <p className="text-destructive text-sm text-center">{error}</p>
        ) : filteredResults.length === 0 && searchQuery ? (
          <p className="text-muted-foreground text-sm text-center">일치하는 유저가 없습니다.</p>
        ) : (
          filteredResults.map((user) => (
            <AddFriendCard
              key={user.memberUid}
              memberId={user.memberUid}
              nickname={user.nickname}
              avatarUrl={user.avatarUrl} // ✅ 아바타 URL 전달
              level={user.level} // ✅ 레벨 전달
              mutualFriends={0}
              requested={requestedIds.has(user.memberUid)}
              onSendRequest={() => handleSendRequest(user.memberUid)}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}