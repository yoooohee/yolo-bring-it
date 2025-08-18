import { useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useUserLoginStore } from '@/app/stores/userStore';
import { useWebSocketStore } from '@/app/stores/websocketStore';

export const useGlobalWebSocket = () => {
  const { userData } = useUserLoginStore();
  const { client, setClient, setIsConnected, setInvitation } = useWebSocketStore();

  useEffect(() => {
    if (userData?.accessToken && userData?.memberUid) {
      if (client?.connected) {
        return;
      }

      console.log('📢 [GlobalSocket] 연결 시도...');

      const newClient = new Client({
        webSocketFactory: () => new SockJS('https://i13c207.p.ssafy.io/ws-game', null, { transports: ['websocket'] }),
        connectHeaders: {
          Authorization: `Bearer ${userData.accessToken}`,
        },
        debug: (msg) => console.log('📢 [GlobalSocket] STOMP Debug:', msg),
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
          console.log('✅ [GlobalSocket] 연결 성공');
          setIsConnected(true);

          // 개인 초대 메시지 구독
          newClient.subscribe(`/topic/participants/${userData.memberUid}`, (message) => {
            try {
              const invitationData = JSON.parse(message.body);
              console.log('💌 [GlobalSocket] 새로운 게임 초대 수신:', invitationData);
              setInvitation(invitationData);
            } catch (error) {
              console.error('[GlobalSocket] 초대 메시지 파싱 실패:', error);
            }
          });
        },
        onStompError: (frame) => {
          console.error('🔴 [GlobalSocket] STOMP 에러:', frame);
          setIsConnected(false);
        },
        onWebSocketClose: () => {
          console.log('🔌 [GlobalSocket] 연결 종료');
          setIsConnected(false);
          setClient(null);
        },
      });

      setClient(newClient);
      newClient.activate();

      return () => {
        if (newClient.connected) {
          console.log('📴 [GlobalSocket] 연결 해제 중...');
          newClient.deactivate();
          setClient(null);
          setIsConnected(false);
        }
      };
    } else {
      if (client?.connected) {
        console.log('📴 [GlobalSocket] 로그아웃으로 연결 해제');
        client.deactivate();
        setClient(null);
        setIsConnected(false);
      }
    }
  }, [userData, setClient, setIsConnected, setInvitation]);
};
