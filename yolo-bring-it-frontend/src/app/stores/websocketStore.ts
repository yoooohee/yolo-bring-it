import { create } from 'zustand';
import { Client } from '@stomp/stompjs';

interface InvitationData {
  roomId: number;
  senderId: number;
  senderNickname: string;
  // roomType, message 등 필요한 경우 다른 초대 관련 데이터 추가
}

interface WebSocketState {
  client: Client | null;
  isConnected: boolean;
  invitation: InvitationData | null;
  userClient: Client | null;
  isUserConnected: boolean;
  setClient: (client: Client | null) => void;
  setIsConnected: (isConnected: boolean) => void;
  setInvitation: (invitation: InvitationData | null) => void;
  clearInvitation: () => void;
  setUserClient: (client: Client | null) => void;
  setIsUserConnected: (isConnected: boolean) => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => ({
  client: null,
  isConnected: false,
  invitation: null,
  userClient: null,
  isUserConnected: false,
  setClient: (client) => set({ client }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setInvitation: (invitation) => set({ invitation }),
  clearInvitation: () => set({ invitation: null }),
  setUserClient: (userClient) => set({ userClient }),
  setIsUserConnected: (isUserConnected) => set({ isUserConnected }),
}));
