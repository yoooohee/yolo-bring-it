import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, User, Menu, X, Settings, ArrowLeft } from "lucide-react";
import { ShopScreen } from "@/pages/ShopScreen";
import InventoryScreen from "@/pages/InventoryScreen";
import { AchievementsScreen } from "@/pages/AchievementsScreen";
import FriendsScreen from "@/pages/FriendsScreen";
import { SettingsScreen } from "@/pages/SettingsScreen";
import { GameGuideScreen } from "@/pages/GameGuideScreen";
import { CharacterViewer } from "@/entities/character/CharacterViewer";
import { useLocalWebRTC } from "@/shared/hooks/useLocalWebRTC";
import { ProfileModal } from "@/shared/ui/profile-modal";
import { useUserLoginStore } from "@/app/stores/userStore";
import apiClient from "@/shared/services/api";

function useIsDesktop(query = "(min-width: 1024px)") {
  const getMatch = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : true);
  const [matches, setMatches] = useState<boolean>(getMatch);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [query]);
  return matches;
}

interface LobbyScreenProps {
  onLogout?: () => void;
  onStartGame: () => void;
}

type SidebarScreen =
  | "shop"
  | "inventory"
  | "achievements"
  | "friends"
  | "settings"
  | "characters"
  | "gameGuide"
  | "ranking";

interface Member {
  member_uid: number;
  name: string;
  nickname: string;
  coin: number;
  score: number;
  xp: number;
}

interface MemberWithLevelExp extends Member {
  lev: number;
  exp: number;
}

interface RecentPlayer {
  id: string;
  nickname: string;
  avatar?: string;
  isFriend: boolean;
  isPending?: boolean;
}

interface MemberSimpleInfo {
  memberUid: number;
  nickname: string;
  lastPlayedAt?: string;
  avatar?: string;
  isFriend?: boolean;
}

interface ApiResponse {
  state: number;
  result: string;
  message: string | null;
  data: {
    myRanking?: { place: number; nickname: string; score: number };
    rankings: RankingInfo[];
    hasNext?: boolean;
    totalItems?: number;
    totalPages?: number;
  } | null;
  error: any[];
}

interface FriendInfo {
  friendUid: number;
  memberId: number;
  isAccepted: boolean;
  online: boolean;
  nickname?: string;
}

interface RankingInfo {
  memberUid: number;
  nickname: string;
  place: number; // API 응답 필드는 'place' 입니다.
  score: number;
  avatar?: string;
}

interface RankingDisplayInfo {
  memberUid: number;
  nickname: string;
  rank: number; // UI에서 사용할 필드
  score: number;
  avatar?: string;
  gameName?: string;
}

function RankingScreen({ onBack, onStartGame }: { onBack: () => void; onStartGame?: () => void }) {
  const [rankings, setRankings] = useState<RankingDisplayInfo[]>([]);
  const [myRanking, setMyRanking] = useState<{ place: number; nickname: string; score: number } | null>(null);
  const [selectedRanking, setSelectedRanking] = useState<"overall" | number>("overall");
  const [page, setPage] = useState<number>(1);
  const [size] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const userData = useUserLoginStore((s) => s.userData || { memberUid: 0 });
  const { memberUid } = userData;

  // ✨ [수정] 게임 이름 변경 및 불필요한 게임 제거
  const gameNames: Record<number, string> = {
    1: "Bring it",
    2: "Face it",
    3: "Color Killer",
    4: "Draw it",
  };

  const fetchRankings = useCallback(
    async (ranking: "overall" | number, selectedPage: number = 1) => {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("accessToken");
      if (!token) {
        setError("인증 토큰이 없습니다. 다시 로그인해주세요.");
        setLoading(false);
        return;
      }

      let requestUrl = "";
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

      if (ranking === "overall") {
        requestUrl = `/users/users/rankings/total?page=${selectedPage - 1}&size=${size}`;
      } else {
        requestUrl = `/games/rankings/${ranking}?page=${selectedPage - 1}&size=${size}`;
        headers["X-MEMBER-UID"] = memberUid.toString();
      }

      try {
        const response = await apiClient.get<ApiResponse>(requestUrl, { headers });

        if (response.data.state === 200 && response.data.data) {
          const { rankings: apiRankings, myRanking, hasNext, totalItems, totalPages: apiTotalPages } = response.data.data;
          
          if (!apiRankings || apiRankings.length === 0) {
            console.log(
              `[RankingScreen] API 통신 성공(200), 하지만 '${ranking}'에 대한 랭킹 데이터가 비어있습니다.`
            );
            setError(
              ranking === "overall"
                ? "전체 랭킹 데이터가 없습니다."
                : `${gameNames[ranking]}의 랭킹이 아직 없습니다. 게임을 플레이해 순위를 기록하세요!`
            );
            setRankings([]);
            setMyRanking(myRanking || null);
            setTotalPages(1);
            setLoading(false);
            return;
          }

          const mappedRankings: RankingDisplayInfo[] = apiRankings.map((item) => ({
            memberUid: item.memberUid,
            nickname: item.nickname || "Unknown Player",
            rank: item.place,
            score: item.score || 0,
            avatar: item.avatar,
            gameName: ranking === "overall" ? "전체 랭킹" : gameNames[ranking],
          }));

          setRankings(mappedRankings);
          setMyRanking(myRanking || null);

          const calculatedTotalPages = apiTotalPages || Math.ceil((totalItems || apiRankings.length) / size) || 1;
          setTotalPages(calculatedTotalPages);
        } else {
          setError(response.data.message || "랭킹 데이터를 가져오지 못했습니다.");
          setRankings([]);
          setMyRanking(null);
          setTotalPages(1);
        }
      } catch (err: any) {
        console.error("[RankingScreen] Error fetching rankings:", err);
        if (err.response?.status === 401) {
          setError("인증이 만료되었습니다. 다시 로그인해주세요.");
        } else if (err.response?.status === 404) {
          setError(ranking === "overall" ? "전체 랭킹이 존재하지 않습니다." : `${gameNames[ranking]}의 랭킹이 존재하지 않습니다.`);
        } else {
          setError("랭킹 데이터를 가져오는 중 오류가 발생했습니다.");
        }
        setRankings([]);
        setMyRanking(null);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [memberUid, size]
  );

  useEffect(() => {
    let isActive = true;
    fetchRankings(selectedRanking, page);
    const intervalId = setInterval(() => {
      if (isActive) {
        fetchRankings(selectedRanking, page);
      }
    }, 30000);
    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [selectedRanking, page, fetchRankings]);

  const handleRankingChange = useCallback((ranking: "overall" | number) => {
    setSelectedRanking(ranking);
    setPage(1);
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-black">랭킹</h2>
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-[#6dc4e8]/20 hover:bg-[#6dc4e8]/30"
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="w-6 h-6 text-[#6dc4e8]" />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <motion.button
          className={`px-4 py-2 text-sm rounded-full transition-colors ${
            selectedRanking === "overall" ? "bg-[#6dc4e8] text-white" : "bg-gray-200/50 text-gray-600"
          }`}
          onClick={() => handleRankingChange("overall")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="전체 랭킹 보기"
        >
          전체 랭킹
        </motion.button>
        {/* ✨ [수정] gameNames 객체를 기반으로 버튼을 동적으로 생성 */}
        {Object.keys(gameNames).map(Number).map((code) => (
          <motion.button
            key={code}
            className={`px-4 py-2 text-sm rounded-full transition-colors ${
              selectedRanking === code ? "bg-[#6dc4e8] text-white" : "bg-gray-200/50 text-gray-600"
            }`}
            onClick={() => handleRankingChange(code)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={`${gameNames[code]} 랭킹 보기`}
          >
            {gameNames[code]}
          </motion.button>
        ))}
      </div>

      {myRanking && (
        <div className="mb-4 p-4 bg-white/30 rounded-lg border border-[#6dc4e8]/20">
          <h3 className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-lg text-black">
            내 랭킹: {myRanking.place}위
          </h3>
          <p className="text-sm text-gray-600">닉네임: {myRanking.nickname}</p>
          <p className="text-sm text-gray-600">점수: {myRanking.score} 점</p>
        </div>
      )}

      {rankings.length > 0 && (
        <div className="mb-4">
          <h3 className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-lg text-black">
            {selectedRanking === "overall" ? "전체 랭킹" : `${rankings[0].gameName}`}
          </h3>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-6">
          <div className="w-8 h-8 border-4 border-[#6dc4e8] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-red-500 gap-4">
          <p className="text-sm">{error}</p>
          {onStartGame && selectedRanking !== "overall" && (
            <motion.button
              className="px-4 py-2 bg-[#6dc4e8] text-white rounded-full"
              onClick={onStartGame}
            	  whileHover={{ scale: 1.05 }}
            	  whileTap={{ scale: 0.95 }}
            	  aria-label="게임 시작하기"
          	>
          	  게임 시작하기
          	</motion.button>
          )}
        </div>
      ) : rankings.length > 0 ? (
        <div className="flex-1 space-y-4 overflow-y-auto">
          {rankings.map((player, index) => (
            <motion.div
              key={`${player.memberUid || index}-${selectedRanking}`}
              className="flex items-center justify-between p-3 bg-white/30 rounded-lg border border-[#6dc4e8]/20"
              initial={{ opacity: 0, x: 20 }}
            	  animate={{ opacity: 1, x: 0 }}
          	  whileHover={{ scale: 1.02 }}
          	>
          	  <div className="flex items-center gap-3">
          	 	 <div className="w-10 h-10 bg-[#6dc4e8]/20 rounded-full flex items-center justify-center">
          	 	   {player.avatar ? (
          	 	 	 <img
          	 	 	   src={player.avatar}
          	 	 	   alt={player.nickname}
          	 	 	   className="w-full h-full rounded-full object-cover"
          	 	 	 />
          	 	   ) : (
          	 	 	 <span className="text-lg">👤</span>
          	 	   )}
          	 	 </div>
          	 	 <div>
          	 	   <p className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-sm text-black">
          	 		 {player.nickname}
          	 	   </p>
          	 	   <p className="text-xs text-gray-500">Rank {player.rank}</p>
          	 	 </div>
          	   </div>
          	   <div className="text-sm font-['BM_HANNA_TTF:Regular',_sans-serif] text-[#6dc4e8]">
          		 {player.score} 점
          	   </div>
          	 </motion.div>
        	))}
        	<div className="flex justify-between items-center mt-4">
        	  <motion.button
        		onClick={() => handlePageChange(page - 1)}
        		disabled={page === 1}
        		className={`px-4 py-2 text-sm rounded-full ${
        		  page === 1 ? "bg-gray-200/50 text-gray-400" : "bg-[#6dc4e8]/20 text-[#6dc4e8]"
        		}`}
        		whileHover={{ scale: page === 1 ? 1 : 1.05 }}
        		whileTap={{ scale: page === 1 ? 1 : 0.95 }}
        		aria-label="이전 페이지"
        	  >
        		이전
        	  </motion.button>
        	  <span className="text-sm text-gray-600">
        		{page} / {totalPages}
        	  </span>
        	  <motion.button
        		onClick={() => handlePageChange(page + 1)}
        		disabled={page === totalPages}
        		className={`px-4 py-2 text-sm rounded-full ${
        		  page === totalPages ? "bg-gray-200/50 text-gray-400" : "bg-[#6dc4e8]/20 text-[#6dc4e8]"
        		}`}
        		whileHover={{ scale: page === totalPages ? 1 : 1.05 }}
        		whileTap={{ scale: page === totalPages ? 1 : 0.95 }}
        		aria-label="다음 페이지"
        	  >
        		다음
        	  </motion.button>
        	</div>
          </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-gray-500 gap-4">
          <p className="text-sm">{error || "랭킹 데이터가 없습니다"}</p>
          {onStartGame && selectedRanking !== "overall" && (
        	<motion.button
        	  className="px-4 py-2 bg-[#6dc4e8] text-white rounded-full"
        	  onClick={onStartGame}
        	  whileHover={{ scale: 1.05 }}
        	  whileTap={{ scale: 0.95 }}
        	  aria-label="게임 시작하기"
        	>
        	  게임 시작하기
        	</motion.button>
          )}
        </div>
      )}
    </div>
  );
}

// ... 이 아래의 다른 컴포넌트들(NicknameTitle, LobbyScreen 등)은 그대로 유지하시면 됩니다 ...
export default RankingScreen;


function NicknameTitle({
  nickname,
  titleSrc = "/410_240_번개.png",
  height = 124,
  paddingX = 0,
  paddingY = 0,
  minWidth = 260, // Fixed typo from min률 to minWidth
  maxWidth = 560,
  fontSize = 24,
  autoFontScale = true,
  className,
}: {
  nickname: string;
  titleSrc?: string;
  height?: number;
  paddingX?: number;
  paddingY?: number;
  minWidth?: number; // Fixed typo from min률 to minWidth
  maxWidth?: number;
  fontSize?: number;
  autoFontScale?: boolean;
  className?: string;
}) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [textW, setTextW] = useState(0);
  const [textH, setTextH] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!textRef.current) return;
    const measure = () => {
      setTextW(textRef.current!.offsetWidth);
      setTextH(textRef.current!.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(textRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [nickname, fontSize]);

  const width = Math.max(minWidth, Math.min(Math.ceil(textW + paddingX * 2), maxWidth));

  const scaledFont = useMemo(() => {
    if (!autoFontScale) return fontSize;
    const baseH = 64;
    const s = height / baseH;
    return Math.max(14, Math.round(fontSize * s));
  }, [height, fontSize, autoFontScale]);

  useEffect(() => {
    const innerW = width - paddingX * 2;
    const innerH = height - paddingY * 2;
    if (innerW <= 0 || innerH <= 0 || textW === 0 || textH === 0) return;
    const scaleX = innerW / textW;
    const scaleY = innerH / textH;
    const next = Math.min(1, scaleX, scaleY);
    setScale(next);
  }, [width, height, paddingX, paddingY, textW, textH]);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className ?? ""}`}
      style={{ width, height }}
      aria-label={`닉네임 배지: ${nickname}`}
      title={nickname}
    >
      <img src={titleSrc} alt="" className="absolute inset-0 w-full h-full pointer-events-none" style={{ objectFit: "fill" }} />
      <span
        ref={textRef}
        className="relative z-[1] whitespace-nowrap font-['BM_HANNA_TTF:Regular',_sans-serif]"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center",
          paddingLeft: paddingX,
          paddingRight: paddingX,
          paddingTop: paddingY,
          paddingBottom: paddingY,
          fontSize: scaledFont,
          lineHeight: 1.1,
          color: "#111",
          textShadow: "0 0 8px rgba(0,0,0,0.25)",
          maxWidth: width - paddingX * 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {nickname}
      </span>
    </div>
  );
}

function BadgeChip({
  badge,
  maxWidth = 320,
  className = "",
  size = "lg",
}: {
  badge: string;
  maxWidth?: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeMap = {
    sm: "text-sm",
    md: "text-base md:text-lg",
    lg: "text-lg md:text-xl lg:text-2xl",
    xl: "text-xl md:text-2xl lg:text-3xl",
  } as const;

  const padMap = {
    sm: "px-3 py-1",
    md: "px-3.5 py-1.5",
    lg: "px-4 py-1.5",
    xl: "px-5 py-2",
  } as const;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full
                  bg-white/80 backdrop-blur border border-[#ffd700]/100 shadow-md
                  ${padMap[size]} ${className}`}
      style={{ maxWidth }}
      title={badge}
    >
      <span
        className={`font-['BM_HANNA_TTF:Regular',_sans-serif] text-[#1f2937]
                    ${sizeMap[size]} leading-tight whitespace-nowrap overflow-hidden text-ellipsis`}
      >
        {badge}
      </span>
    </div>
  );
}

export function LobbyScreen({ onStartGame }: LobbyScreenProps) {
  const isDesktop = useIsDesktop();

  const [currentView, setCurrentView] = useState<SidebarScreen | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, setIsVideoLoading] = useState(false);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [recentPlayers, setRecentPlayers] = useState<RecentPlayer[]>([]);

  const {
    videoRef,
    isVideoEnabled,
    isAudioEnabled,
    isConnecting,
    error,
    startVideo,
    stopVideo,
    toggleVideo,
    toggleAudio,
    connectVideoElements,
  } = useLocalWebRTC();

  const userData = useUserLoginStore((s) => s.userData || {
    memberUid: 0,
    nickname: "Guest",
    xp: 0,
    char3dpath: "",
    char2dpath: "",
    firstWinCnt: 0,
    secondWinCnt: 0,
    thirdWinCnt: 0,
    playCnt: 0,
  });
  const { memberUid, nickname, xp, char3dpath, char2dpath, firstWinCnt, secondWinCnt, thirdWinCnt, playCnt } = userData;
  const setUser = useUserLoginStore((s) => s.setUser);

  const lev = Math.floor(xp / 100);
  const exp = Math.floor(xp % 100);

  const connectionStatus = isConnecting ? "connecting" : isVideoEnabled ? "connected" : "disconnected";
  const isWebcamEnabled = isVideoEnabled;
  const isMicEnabled = isAudioEnabled;

  const defaultModel =
    "https://pub-1b87520b13004863b6faad8458f37850.r2.dev/%ED%86%A0%EB%81%BC_%EB%82%A8%EC%9E%90_3D.glb";
  const safeModelUrl = char3dpath && char3dpath.trim().length > 0 ? char3dpath : defaultModel;

  const [mobileMainView, setMobileMainView] = useState<"character" | "webcam">("character");

  useEffect(() => {
    const fetchRecentPlayersAndFriends = async () => {
      console.log(`fetchRecentPlayersAndFriends 호출 시작: memberUid=${memberUid}`);
      if (!memberUid) {
        console.log("memberUid 없음, recentPlayers를 빈 배열로 설정");
        setRecentPlayers([]);
        return;
      }

      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          console.error("accessToken이 없습니다");
          setRecentPlayers([]);
          alert("로그인이 필요합니다.");
          return;
        }

        const recentResponse = await apiClient.get<ApiResponse>(
          `/games/users/${memberUid}/last-game-users`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("최근 플레이어 API 응답:", recentResponse.data);

        if (!recentResponse.data.data || !Array.isArray(recentResponse.data.data)) {
          console.error("최근 플레이어 API 응답의 data 필드가 유효하지 않습니다:", recentResponse.data);
          setRecentPlayers([]);
          alert("최근 플레이어 데이터를 가져오지 못했습니다.");
          return;
        }

        const friendsResponse = await apiClient.get<ApiResponse>(
          `/users/friends`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("친구 목록 API 응답:", friendsResponse.data);

        if (!friendsResponse.data.data || !Array.isArray(friendsResponse.data.data)) {
          console.error("친구 목록 API 응답의 data 필드가 유효하지 않습니다:", friendsResponse.data);
          setRecentPlayers([]);
          alert("친구 목록 데이터를 가져오지 못했습니다.");
          return;
        }

        const friendIds = (friendsResponse.data.data as any[])
          .filter(friend => friend.isAccepted === true && friend.memberId !== undefined)
          .map(friend => friend.memberId.toString());

        console.log("처리된 친구 ID 목록:", friendIds);

        const players = recentResponse.data.data
          .filter((player): player is MemberSimpleInfo => 'memberUid' in player && player.memberUid !== undefined)
          .slice(0, 4)
          .map((player: MemberSimpleInfo) => ({
            id: player.memberUid!.toString(),
            nickname: player.nickname || "알 수 없는 플레이어",
            avatar: player.avatar || undefined,
            isFriend: friendIds.includes(player.memberUid!.toString()),
            isPending: false,
          }));

        setRecentPlayers((prev) =>
          players.map((newPlayer) => {
            const existingPlayer = prev.find((p) => p.id === newPlayer.id);
            return {
              ...newPlayer,
              isPending: existingPlayer?.isPending || false,
            };
          })
        );

        console.log("처리된 플레이어 데이터:", players);
      } catch (error) {
        console.error("데이터를 가져오지 못했습니다:", error);
        setRecentPlayers([]);
        alert("최근 플레이어 또는 친구 목록을 가져오는데 실패했습니다.");
      }
    };

    fetchRecentPlayersAndFriends();

    const intervalId = setInterval(() => {
      fetchRecentPlayersAndFriends();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [memberUid]);

  useEffect(() => {
    if (mobileMainView === "webcam") {
      const initializeVideo = async () => {
        if (!isVideoEnabled) {
          await startVideo();
        }
        setTimeout(() => {
          connectVideoElements();
        }, 500);
      };
      initializeVideo();
    }
  }, [mobileMainView, connectVideoElements, isVideoEnabled, startVideo]);

  useEffect(() => {
    if (isWebcamModalOpen && isVideoEnabled) {
      setTimeout(connectVideoElements, 100);
    }
  }, [isWebcamModalOpen, connectVideoElements, isVideoEnabled]);

  useEffect(() => {
    if (!isWebcamModalOpen && isVideoEnabled) {
      setTimeout(connectVideoElements, 200);
    }
  }, [isWebcamModalOpen, connectVideoElements, isVideoEnabled]);

  const sidebarItems = [
    { id: "shop" as SidebarScreen, label: "상점", icon: "🛒", action: () => setCurrentView("shop"), delay: 0.1 },
    { id: "inventory" as SidebarScreen, label: "보관함", icon: "🎒", action: () => setCurrentView("inventory"), delay: 0.15 },
    { id: "achievements" as SidebarScreen, label: "업적", icon: "🏆", action: () => setCurrentView("achievements"), delay: 0.2 },
    { id: "friends" as SidebarScreen, label: "친구", icon: "👥", action: () => setCurrentView("friends"), delay: 0.25 },
    { id: "gameGuide" as SidebarScreen, label: "게임 가이드", icon: "📖", action: () => setCurrentView("gameGuide"), delay: 0.3 },
    { id: "ranking" as SidebarScreen, label: "랭킹", icon: "🏅", action: () => setCurrentView("ranking"), delay: 0.35 },
  ];

  const toggleWebcam = useCallback(async () => {
    setIsVideoLoading(true);
    await toggleVideo();
    setIsVideoLoading(false);
  }, [toggleVideo]);

  const sidebarContent = useMemo(() => {
    if (!currentView) return null;
    switch (currentView) {
      case "shop":
        return <ShopScreen onBack={() => setCurrentView(null)} />;
      case "inventory":
        return <InventoryScreen onBack={() => setCurrentView(null)} />;
      case "achievements":
        return <AchievementsScreen onBack={() => setCurrentView(null)} />;
      case "friends":
        return <FriendsScreen />;
      case "settings":
        return <SettingsScreen onBack={() => setCurrentView(null)} />;
      case "characters":
        return (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-black">캐릭터 선택</h2>
              <button
                onClick={() => setCurrentView(null)}
                className="p-2 rounded-lg bg-[#6dc4e8]/20 hover:bg-[#6dc4e8]/30"
            	>
            	  <ArrowLeft className="w-6 h-6 text-[#6dc4e8]" />
          	  </button>
        	  </div>
        	  <CharacterViewer key={safeModelUrl} modelUrl={safeModelUrl} />
        	</div>
        );
      case "gameGuide":
        return <GameGuideScreen onBack={() => setCurrentView(null)} />;
      case "ranking":
        return <RankingScreen onBack={() => setCurrentView(null)} onStartGame={onStartGame} />;
  	default:
  	  return null;
  	}
  }, [currentView, safeModelUrl, onStartGame]);


  const toggleMic = useCallback(async () => {
    await toggleAudio();
  }, [toggleAudio]);

  const handleMenuToggle = () => setIsMenuOpen(!isMenuOpen);
  const handleSettingsClick = () => setCurrentView("settings");
  const handleProfileClick = () => setIsProfileModalOpen(true);

  const handleAddFriend = useCallback(
    async (playerId: string) => {
  	  try {
  		const token = localStorage.getItem("accessToken");
  		if (!token) {
  		  alert("로그인이 필요합니다.");
  		  return;
  		}

  		console.log("친구 요청 전송:", { playerId, token });
  		const response = await apiClient.post<ApiResponse>(
  		  `/users/friends/${playerId}`,
  		  {},
  		  {
  			headers: {
  			  Authorization: `Bearer ${token}`,
  			},
  		  }
  		);

  		console.log("친구 요청 API 응답:", response.data);
  		if (response.data.state === 200 && response.data.result === "success") {
  		  setRecentPlayers((prev) =>
  			prev.map((player) =>
  			  player.id === playerId ? { ...player, isFriend: false, isPending: true } : player
  			)
  		  );
  		  alert(response.data.message || "친구 요청을 보냈습니다.");
  		} else {
  		  alert(response.data.message || "친구 요청에 실패했습니다.");
  		}
  	  } catch (error) {
  		console.error("친구 요청 중 오류 발생:", error);
  		alert("친구 요청 중 오류가 발생했습니다.");
  	  }
  	},
  	[]
  );

  useEffect(() => {
    return () => {
      stopVideo();
    };
  }, [stopVideo]);

  const WinRateCard = useMemo(() => {
    const wins = firstWinCnt + secondWinCnt + thirdWinCnt;
    const losses = playCnt - wins;
    const winRate = playCnt > 0 ? Math.round((wins / playCnt) * 100) : 0;

    return (
  	  <motion.div
  		className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border-2 border-[#6dc4e8]/30 shadow-lg"
  		initial={{ scale: 0.9, opacity: 0 }}
  		animate={{ scale: 1, opacity: 1 }}
  		transition={{ delay: 1.2, duration: 0.6 }}
  	  >
  		<div className="flex items-center justify-between h-full">
  		  <div className="relative flex items-center justify-center">
  			<svg width="80" height="80" className="transform -rotate-90">
  			  <circle cx="40" cy="40" r="32" stroke="rgba(109,196,232,0.2)" strokeWidth="8" fill="none" />
  			  <motion.circle
  				cx="40"
  				cy="40"
  				r="32"
  				stroke="url(#winRateGradient)"
  				strokeWidth="8"
  				fill="none"
  				strokeLinecap="round"
  				strokeDasharray={`${2 * Math.PI * 32}`}
  				initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
  				animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - winRate / 100) }}
  				transition={{ delay: 1.5, duration: 1.5, ease: "easeOut" }}
  			  />
  			  <defs>
  				<linearGradient id="winRateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
  				  <stop offset="0%" stopColor="#6dc4e8" />
  				  <stop offset="100%" stopColor="#5ab4d8" />
  				</linearGradient>
  			  </defs>
  			</svg>
  			<div className="absolute inset-0 flex flex-col items-center justify-center">
  			  <motion.span
  				className="text-2xl lg:text-3xl font-['BM_HANNA_TTF:Regular',_sans-serif] text-[#6dc4e8] tracking-wide"
  				initial={{ opacity: 0, scale: 0.5 }}
  				animate={{ opacity: 1, scale: 1 }}
  				transition={{ delay: 2, duration: 0.5 }}
  			  >
  				{winRate}%
  			  </motion.span>
  			</div>
  		  </div>
  		  <div className="flex flex-col items-end space-y-1 lg:space-y-2">
  			<div className="text-right">
  			  <span className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-sm lg:text-base text-gray-600">승률</span>
  			</div>
  			<motion.div
  			  className="flex items-center gap-2"
  			  initial={{ opacity: 0, x: 20 }}
  			  animate={{ opacity: 1, x: 0 }}
  			  transition={{ delay: 1.8, duration: 0.6 }}
  			>
  			  <div className="text-center">
  				<div className="text-lg lg:text-xl font-['BM_HANNA_TTF:Regular',_sans-serif] text-green-600">{wins}승</div>
  				<div className="text-xs text-gray-500">WIN</div>
  			  </div>
  			  <div className="w-px h-8 bg-gray-300 mx-1"></div>
  			  <div className="text-center">
  				<div className="text-lg lg:text-xl font-['BM_HANNA_TTF:Regular',_sans-serif] text-red-500">{losses}패</div>
  				<div className="text-xs text-gray-500">LOSE</div>
  			  </div>
  			</motion.div>
  			<motion.div
  			  className="text-xs text-gray-500 mt-1"
  			  initial={{ opacity: 0 }}
  			  animate={{ opacity: 1 }}
  			  transition={{ delay: 2.2, duration: 0.4 }}
  			>
  			  총 {playCnt}게임
  			</motion.div>
  		  </div>
  		</div>
  	  </motion.div>
  	);
  }, [firstWinCnt, secondWinCnt, thirdWinCnt, playCnt]);

  const WebcamArea = useMemo(
    () => (
  	  <motion.div
  		className="bg-white/50 backdrop-blur-sm rounded-xl border border-[#6dc4e8]/20 p-4"
  		initial={{ scale: 0.9, opacity: 0 }}
  		animate={{ scale: 1, opacity: 1 }}
  		transition={{ delay: 1.4, duration: 0.6 }}
  	  >
  		<div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden cursor-pointer" onClick={() => setIsWebcamModalOpen(true)}>
  		  <video
  			ref={videoRef}
  			className="w-full h-full object-cover"
  			autoPlay
  			playsInline
  			muted
  			style={{ backgroundColor: "transparent", transform: "scaleX(1)", display: "block", minHeight: "100%", minWidth: "100%" }}
  		  />
  		  {!isWebcamEnabled && (
  			<div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white/60">
  			  <Video className="w-16 h-16" />
  			</div>
  		  )}
  		  <div className="absolute bottom-3 left-3 right-3 flex justify-center gap-3">
  			<motion.button
  			  className={`p-3 rounded-full ${isWebcamEnabled ? "bg-[#6dc4e8]/80" : "bg-red-500/80"} backdrop-blur-sm text-white`}
  			  onClick={(e) => {
  				e.stopPropagation();
  				toggleWebcam();
  			  }}
  			  disabled={isConnecting}
  			  whileHover={{ scale: 1.1 }}
  			  whileTap={{ scale: 0.9 }}
  			>
  			  {isConnecting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isWebcamEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
  			</motion.button>

  			<motion.button
  			  className={`p-3 rounded-full ${isMicEnabled ? "bg-[#6dc4e8]/80" : "bg-red-500/80"} backdrop-blur-sm text-white`}
  			  onClick={(e) => {
  				e.stopPropagation();
  				toggleMic();
  			  }}
  			  disabled={!isVideoEnabled}
  			  whileHover={{ scale: 1.1 }}
  			  whileTap={{ scale: 0.9 }}
  			>
  			  {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
  			</motion.button>
  		  </div>

  		  <div className="absolute top-3 right-3">
  			<div
  			  className={`flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-sm ${connectionStatus === "connected" ? "bg-green-500/80" : connectionStatus === "connecting" ? "bg-yellow-500/80" : "bg-gray-500/80"
  				} text-white text-xs`}
  			>
  			  <div className={`w-2 h-2 rounded-full ${connectionStatus === "connected" ? "bg-green-300" : connectionStatus === "connecting" ? "bg-yellow-300 animate-pulse" : "bg-gray-300"}`} />
  			  {connectionStatus === "connected" ? "연결됨" : connectionStatus === "connecting" ? "연결 중" : "대기 중"}
  			</div>
  		  </div>
  		</div>

  		{error && (
  		  <motion.div className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
  			{error}
  		  </motion.div>
  		)}
  	  </motion.div>
  	),
  	[videoRef, isWebcamEnabled, isMicEnabled, isConnecting, connectionStatus, error, toggleWebcam, toggleMic, setIsWebcamModalOpen]
  );

  const WebcamModal = useMemo(
    () => (
  	  <AnimatePresence>
  		{isWebcamModalOpen && (
  		  <motion.div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
  			<motion.div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
  			  <video
  				ref={videoRef}
  				className="w-full h-full object-cover"
  				autoPlay
  				playsInline
  				muted
  				style={{ backgroundColor: "transparent", transform: "scaleX(1)", display: "blocke", minHeight: "100%", minWidth: "100%" }}
  			  />

  			  {!isWebcamEnabled && (
  				<div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white/60">
  				  <Video className="w-32 h-32" />
  				</div>
  			  )}

  			  <motion.button className="absolute top-4 right-4 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70" onClick={() => setIsWebcamModalOpen(false)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
  				<X className="w-6 h-6" />
  			  </motion.button>

  			  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
  				<motion.button
  				  className={`p-4 rounded-full ${isWebcamEnabled ? "bg-[#6dc4e8]/80" : "bg-red-500/80"} backdrop-blur-sm text-white`}
  				  onClick={toggleWebcam}
  				  disabled={isConnecting}
  				  whileHover={{ scale: 1.1 }}
  				  whileTap={{ scale: 0.9 }}
  				>
  				  {isConnecting ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isWebcamEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
  				</motion.button>

  				<motion.button
  				  className={`p-4 rounded-full ${isMicEnabled ? "bg-[#6dc4e8]/80" : "bg-red-500/80"} backdrop-blur-sm text-white`}
  				  onClick={toggleMic}
  				  disabled={!isVideoEnabled}
  				  whileHover={{ scale: 1.1 }}
  				  whileTap={{ scale: 0.9 }}
  				>
  				  {isMicEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
  				</motion.button>
  			  </div>
  			</motion.div>
  		  </motion.div>
  		)}
  	  </AnimatePresence>
  	),
  	[isWebcamModalOpen, videoRef, isWebcamEnabled, isMicEnabled, isConnecting, isVideoEnabled, toggleWebcam, toggleMic]
  );

  const RecentPlayersSection = useMemo(
    () => (
  	  <motion.div
  		className="bg-white/50 backdrop-blur-sm rounded-xl border border-[#6dc4e8]/20 p-4"
  		initial={{ scale: 0.9, opacity: 0 }}
  		animate={{ scale: 1, opacity: 1 }}
  		transition={{ delay: 1.6, duration: 0.6 }}
  	  >
  		<div className="flex items-center justify-between mb-3">
  		  <h3 className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-lg text-black tracking-wider">최근 플레이어</h3>
  		  <span className="text-xs text-gray-500">직전 게임</span>
  		</div>

  		{recentPlayers.length > 0 ? (
  		  <div className="space-y-2">
  			{recentPlayers.map((player) => (
  			  <motion.div
  				key={player.id}
  				className="flex items-center justify-between p-3 bg-white/30 rounded-lg border border-[#6dc4e8]/20"
  				initial={{ opacity: 0, x: 20 }}
  				animate={{ opacity: 1, x: 0 }}
  				whileHover={{ scale: 1.02 }}
  			  >
  				<div className="flex items-center gap-3">
  				  <div className="w-10 h-10 bg-[#6dc4e8]/20 rounded-full flex items-center justify-center">
  					{player.avatar ? (
  					  <img src={player.avatar} alt={player.nickname} className="w-full h-full rounded-full object-cover" />
  					) : (
  					  <span className="text-lg">👤</span>
  					)}
  				  </div>
  				  <div>
  					<p className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-sm text-black">{player.nickname}</p>
  				  </div>
  				</div>

  				{player.isPending ? (
  				  <span className="px-3 py-1 bg-yellow-500/20 rounded-full text-xs font-['BM_HANNA_TTF:Regular',_sans-serif] text-yellow-600 border border-yellow-500/30">요청 대기</span>
  				) : player.isFriend ? (
  				  <span className="px-3 py-1 bg-green-500/20 rounded-full text-xs font-['BM_HANNA_TTF:Regular',_sans-serif] text-green-600 border border-green-500/30">친구</span>
  				) : (
  				  <motion.button
  					className="px-3 py-1 bg-[#6dc4e8]/20 hover:bg-[#6dc4e8]/30 rounded-full text-xs font-['BM_HANNA_TTF:Regular',_sans-serif] text-[#6dc4e8] border border-[#6dc4e8]/30"
  					onClick={() => handleAddFriend(player.id)}
  					whileHover={{ scale: 1.05 }}
  					whileTap={{ scale: 0.95 }}
  				  >
  					친구추가
  				  </motion.button>
  				)}
  			  </motion.div>
  			))}
  		  </div>
  		) : (
  		  <div className="text-center py-6 text-gray-500">
  			<p className="text-sm">최근 게임 기록이 없습니다</p>
  		  </div>
  		)}
  	  </motion.div>
  	),
  	[recentPlayers, handleAddFriend]
  );

  const [member, setMember] = useState<MemberWithLevelExp | null>(null);

  useEffect(() => {
    fetch("/member.json")
      .then((res) => res.json())
      .then((data: Member[]) => {
        const raw = data[0];
        const lev = Math.floor(raw.xp / 100);
        const exp = Math.min(raw.xp % 100, 100);

        setMember({ ...raw, lev, exp });
        const current = useUserLoginStore.getState().userData;
        if (current) {
          setUser({ ...current, coin: raw.coin });
        }
      })
      .catch(() => {
        // dev mock 실패 무시
      });
  }, [setUser]);

  const handleProfileClose = () => setIsProfileModalOpen(false);

  const badgeText = useMemo(() => nickname ?? "전설의 토끼조련사", [nickname]);

  return (
    <div className="h-screen bg-background text-foreground font-optimized flex flex-col lg:grid lg:grid-cols-[300px_1fr_350px] lg:grid-rows-[auto_1fr] overflow-hidden">
      <MobileSidebar />
      {WebcamModal}
      <ProfileModal isOpen={isProfileModalOpen} onClose={handleProfileClose} isOwnProfile={true} />

      {member && (
        <motion.header
          className="relative col-span-1 lg:col-span-3 flex justify-between items-center p-6 bg-white/50 backdrop-blur-sm border-b border-[#6dc4e8]/20"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute left-1/2 -translate-x-1/2">
            <motion.button
              type="button"
              className="group relative px-4 py-2 rounded-xl bg-[#6dc4e8]/10 hover:bg-[#6dc4e8]/20 border border-[#6dc4e8]/30 shadow-sm"
              onClick={() => setCurrentView(null)}
            	  whileHover={{ scale: 1.05 }}
          	  whileTap={{ scale: 0.95 }}
          	  aria-label="로비로 이동"
        	  >
        	  <span className="block font-['BM_HANNA_TTF:Regular',_sans-serif] text-xl lg:text-2xl tracking-widest text-[#6dc4e8] transition-opacity duration-200 group-hover:opacity-0">
        		YOLO
        	  </span>
        	  <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-['BM_HANNA_TTF:Regular',_sans-serif] text-xl lg:text-2xl tracking-widest text-[#6dc4e8] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        		Bring It
        	  </span>
        	</motion.button>
          </div>

          <div className="flex items-center gap-3 lg:gap-8">
        	<button className="p-2 rounded-lg bg-[#6dc4e8]/20 hover:bg-[#6dc4e8]/30 lg:hidden" onClick={() => setIsMenuOpen((v) => !v)}>
        	  <Menu className="w-6 h-6 text-[#6dc4e8]" />
        	</button>
        	<div className="hidden lg:flex items-center gap-4">
        	  <span className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-xl text-black tracking-wider">Lev : {lev}</span>
        	  <div className="flex items-center gap-2">
        		<span className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-xl text-black tracking-wider">Exp :</span>
        		<div className="w-[200px] h-[25px] border-[3px] border-[#6dc4e8] rounded-md relative overflow-hidden">
        		  <motion.div className="h-full bg-gradient-to-r from-[#6dc4e8] to-[#5ab4d8] rounded-sm" initial={{ width: 0 }} animate={{ width: `${exp}%` }} transition={{ delay: 1, duration: 1, ease: "easeOut" }} />
        		</div>
        	  </div>
        	</div>
          </div>

          <div className="flex items-center gap-4 lg:gap-8">
        	<motion.button className="p-2 rounded-lg bg-[#6dc4e8]/20 hover:bg-[#6dc4e8]/30" onClick={handleProfileClick} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        	  <User className="w-6 h-6 text-[#6dc4e8]" />
        	</motion.button>
        	<motion.button className="p-2 rounded-lg bg-[#6dc4e8]/20 hover:bg-[#6dc4e8]/30" onClick={() => setCurrentView("settings")} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}>
        	  <Settings className="w-6 h-6 text-[#6dc4e8]" />
        	</motion.button>
          </div>
        </motion.header>
      )}

      <motion.aside className="hidden lg:flex flex-col bg-white/80 backdrop-blur-sm border-r border-[#6dc4e8]/20 p-6 overflow-y-auto" initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, ease: "easeOut" }}>
        <h2 className="text-2xl font-bold mb-6 text-black">메뉴</h2>
        <div className="space-y-4">
          {sidebarItems.map((item) => (
            <motion.button
              key={item.id}
            	  className="w-full bg-[rgba(109,196,232,0.2)] hover:bg-[rgba(109,196,232,0.3)] rounded-[20px] p-4 flex items-center gap-6"
          	  initial={{ x: -50, opacity: 0 }}
          	  animate={{ x: 0, opacity: 1 }}
          	  transition={{ delay: item.delay, duration: 0.5 }}
          	  whileHover={{ scale: 1.05 }}
          	  whileTap={{ scale: 0.95 }}
          	  onClick={item.action}
        	  >
        	  <div className="w-[70px] h-[70px] text-4xl bg-white/50 rounded-full border-2 border-[#6dc4e8]/30 flex-shrink-0 flex items-center justify-center">
        		{item.icon}
        	  </div>
        	  <span className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-2xl text-black tracking-wider">{item.label}</span>
        	</motion.button>
      	  ))}
        </div>
      </motion.aside>

      <main className="p-4 lg:p-8 overflow-y-auto">
    	{currentView ? (
    	  <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-[#6dc4e8]/20 h-full">{sidebarContent}</div>
    	) : (
    	  <div className="w-full h-full flex flex-col items-center justify-center gap-2 lg:gap-3">
    		<div className="lg:hidden bg-gray-200/50 p-1 rounded-full flex items-center gap-1 mb-2">
    		  <button onClick={() => setMobileMainView("character")} className={`px-4 py-2 text-sm rounded-full transition-colors ${mobileMainView === "character" ? "bg-white shadow" : "text-gray-600"}`}>
    			캐릭터
    		  </button>
    		  <button onClick={() => setMobileMainView("webcam")} className={`px-4 py-2 text-sm rounded-full transition-colors ${mobileMainView === "webcam" ? "bg-white shadow" : "text-gray-600"}`}>
    			내 모습
    		  </button>
    		</div>

    		{isDesktop ? (
    		  <div className="w-[400px] h-[400px]">
    			<CharacterViewer key={safeModelUrl} modelUrl={safeModelUrl} width="100%" height="100%" />
    		  </div>
    		) : (
    		  <div className="flex items-center justify-center w-full min-h-[300px]">
    			<AnimatePresence mode="wait">
    			  {mobileMainView === "character" && (
    				<motion.div
    				  key="mobile-character"
    				  className="relative pointer-events-none flex justify-center items-center"
    				  initial={{ opacity: 0, scale: 0.9 }}
    				  animate={{ opacity: 1, scale: 1 }}
    				  exit={{ opacity: 0, scale: 0.9 }}
    				>
    				  <div className="w-[250px] h-[250px]">
    					<CharacterViewer key={safeModelUrl} modelUrl={safeModelUrl} width="100%" height="100%" />
    				  </div>
    				</motion.div>
    			  )}

    			  {mobileMainView === "webcam" && (
    				<motion.div key="mobile-webcam" className="w-full max-w-sm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
    				  <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-[#6dc4e8]/20 p-4">
    					<div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
    					  <video
    						ref={videoRef}
    						className="w-full h-full object-cover"
    						autoPlay
    						playsInline
    						muted
    						style={{ backgroundColor: "transparent", transform: "scaleX(1)", display: "block", minHeight: "100%", minWidth: "100%" }}
    					  />

    					  {!isWebcamEnabled && (
    						<div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white/60">
    						  <Video className="w-16 h-16" />
    						</div>
    					  )}

    					  <div className="absolute bottom-3 left-3 right-3 flex justify-center gap-3">
    						<motion.button
    						  className={`p-3 rounded-full ${isWebcamEnabled ? "bg-[#6dc4e8]/80" : "bg-red-500/80"} backdrop-blur-sm text-white`}
    						  onClick={toggleWebcam}
    						  disabled={isConnecting}
    						  whileHover={{ scale: 1.1 }}
    						  whileTap={{ scale: 0.9 }}
    						>
    						  {isConnecting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isWebcamEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
    						</motion.button>

    						<motion.button
    						  className={`p-3 rounded-full ${isMicEnabled ? "bg-[#6dc4e8]/80" : "bg-red-500/80"} backdrop-blur-sm text-white`}
    						  onClick={toggleMic}
    						  disabled={!isVideoEnabled}
    						  whileHover={{ scale: 1.1 }}
    						  whileTap={{ scale: 0.9 }}
    						>
    						  {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
    						</motion.button>
    					  </div>
    					</div>
    				  </div>
    				</motion.div>
    			  )}
    			</AnimatePresence>
    		  </div>
    		)}

    		{member && (
    		  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.4 }} className="-mt-1">
    			<div className="flex flex-col items-center gap-1 lg:gap-1.5">
    			  <BadgeChip badge={badgeText} className="mx-auto" />
    			  <div>
    				<NicknameTitle className="lg:hidden" nickname={nickname ?? "Guest"} height={84} fontSize={34} paddingX={28} paddingY={10} minWidth={260} maxWidth={560} />
    				<NicknameTitle className="hidden lg:inline-flex" nickname={nickname ?? "Guest"} height={110} fontSize={30} autoFontScale={false} />
    			  </div>
    			</div>
    		  </motion.div>
    		)}

    		<motion.button
    		  className="-mt-4 lg:-mt-6 bg-[rgba(109,196,232,0.2)] hover:bg-[rgba(109,196,232,0.3)] px-16 py-8 rounded-[40px] border-2 border-transparent hover:border-[#6dc4e8] shadow-lg mt-2 lg:mt-1"
    		  initial={{ opacity: 0, y: 30 }}
    		  animate={{ opacity: 1, y: 0 }}
    		  transition={{ delay: 1, duration: 0.6 }}
    		  whileHover={{ scale: 1.05 }}
    		  whileTap={{ scale: 0.9 }}
    		  onClick={onStartGame}
    		>
    		  <span className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-3xl tracking-[5px] text-black">참 가 하 기</span>
    		</motion.button>
    	  </div>
    	)}
      </main>

      <motion.div className="hidden lg:flex flex-col bg-white/50 backdrop-blur-sm border-l border-[#6dc4e8]/20 p-6 space-y-6" initial={{ x: 350, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}>
    	{WinRateCard}
    	{WebcamArea}
    	{RecentPlayersSection}
      </motion.div>
    </div>
  );

  function MobileSidebar() {
    return (
  	  <AnimatePresence>
  		{isMenuOpen && (
  		  <motion.div
  			className="fixed inset-y-0 left-0 w-64 bg-white/90 backdrop-blur-sm border-r border-[#6dc4e8]/20 z-50 lg:hidden"
  			initial={{ x: -256 }}
  			animate={{ x: 0 }}
  			exit={{ x: -256 }}
  			transition={{ type: "spring", damping: 25, stiffness: 200 }}
  		  >
  			<div className="p-4">
  			  <div className="flex justify-between items-center mb-6">
  				<h2 className="text-lg font-bold text-black">메뉴</h2>
  				<motion.button className="p-2 rounded-lg bg-[#6dc4e8]/20 hover:bg-[#6dc4e8]/30" onClick={() => setIsMenuOpen(false)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
  				  <X className="w-5 h-5 text-[#6dc4e8]" />
  				</motion.button>
  			  </div>
  			  <nav className="space-y-2">
  				{sidebarItems.map((item) => (
  				  <motion.button
  					key={item.id}
  					className="w-full bg-[rgba(109,196,232,0.2)] hover:bg-[rgba(109,196,232,0.3)] rounded-[20px] p-3 flex items-center gap-3"
  					onClick={() => {
  					  item.action();
  					  setIsMenuOpen(false);
  					}}
  					whileHover={{ scale: 1.02 }}
  					whileTap={{ scale: 0.98 }}
  				  >
  					<span className="text-xl">{item.icon}</span>
  					<span className="font-['BM_HANNA_TTF:Regular',_sans-serif] text-lg text-black tracking-wider">{item.label}</span>
  				  </motion.button>
  				))}
  			  </nav>
  			</div>
  		  </motion.div>
  		)}
  	  </AnimatePresence>
  	);
  }
}