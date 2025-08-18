import { useNavigate } from "react-router-dom";
import { useWebSocketStore } from '@/app/stores/websocketStore'; // 변경된 스토어 import
import { useUserLoginStore } from "@/app/stores/userStore";
import apiClient from "@/shared/services/api";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./dialog";

export function InvitationModal() {
  const { invitation, clearInvitation } = useWebSocketStore(); // useInvitationStore -> useWebSocketStore
  const { userData } = useUserLoginStore();
  const navigate = useNavigate();

  const handleAccept = async () => {
    if (!invitation || !userData?.accessToken || !userData?.memberUid) return;

    try {
      // 초대 수락 API 호출 (헤더는 인터셉터가 처리)
      await apiClient.patch(
        `/games/rooms/${invitation.roomId}/invitation/${invitation.senderId}/accepted`,
        {},
        {
          headers: {
            'X-MEMBER-UID': userData.memberUid.toString(),
          },
        }
      );
      console.log('✅ 초대 수락 성공!');
      
      // 초대 수락 후 해당 게임방으로 화면 전환
      navigate(`/waiting?mode=custom&roomId=${invitation.roomId}`);
      
      clearInvitation();
    } catch (error) {
      console.error('❌ 초대 수락 실패:', error);
      alert('초대 수락에 실패했습니다.');
      clearInvitation();
    }
  };

  const handleDecline = () => {
    console.log('🚫 초대 거절');
    clearInvitation();
  };

  return (
    <Dialog open={!!invitation} onOpenChange={(open) => !open && clearInvitation()}>
      <DialogContent className="bg-slate-50 border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-800">게임 초대</DialogTitle>
          <DialogDescription className="text-slate-600 pt-2">
            <span className="font-semibold text-[#6dc4e8]">{invitation?.senderNickname}</span>님이 게임에 초대했습니다. 함께 하시겠습니까?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end mt-4">
          <Button variant="outline" onClick={handleDecline}>거절</Button>
          <Button onClick={handleAccept} className="bg-[#6dc4e8] hover:bg-[#5ab4d8] text-white">수락</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
