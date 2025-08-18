import { useEffect, useRef, useCallback, useState } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useUserLoginStore } from '@/app/stores/userStore';

interface ChatSocketConfig {
  onChatMessage?: (data: any) => void;
  onError?: (error: any) => void;
}

const CHAT_SOCKET_URL = 'https://i13c207.p.ssafy.io/ws-chat';
const log = (...args: any[]) => console.log(`[ChatSocket]`, ...args);
const err = (...args: any[]) => console.error(`[ChatSocket] ❌`, ...args);

let clientInstance: Client | null = null;
let activeSubscriptions = 0;

export const useChatWebSocket = (config: ChatSocketConfig) => {
  const { userData } = useUserLoginStore();
  const [isConnected, setIsConnected] = useState(clientInstance?.connected ?? false);
  const savedHandlers = useRef(config);

  useEffect(() => {
    savedHandlers.current = config;
  }, [config]);

  useEffect(() => {
    if (!userData?.accessToken || !userData.memberUid) {
      if (clientInstance) {
        log('사용자 정보 없음, 연결 해제 시도');
        clientInstance.deactivate();
        clientInstance = null;
        setIsConnected(false);
      }
      return;
    }

    activeSubscriptions++;

    if (!clientInstance) {
      log('새로운 클라이언트 생성 및 연결 시작...');
      const client = new Client({
        webSocketFactory: () => new SockJS(CHAT_SOCKET_URL),
        connectHeaders: {
          Authorization: `Bearer ${userData.accessToken}`,
        },
        debug: (msg) => console.log('📢 [ChatSocket] STOMP:', msg),
        reconnectDelay: 10000,
        onConnect: () => {
          log('✅ 연결 성공');
          setIsConnected(true);

          const destination = `/queue/chat-user-${userData.memberUid}`;
          log(`🔔 개인 메시지 구독 시작: ${destination}`);
          client.subscribe(destination, (message: IMessage) => {
            try {
              const chatMessage = JSON.parse(message.body);
              log('💬 메시지 수신:', chatMessage);
              savedHandlers.current?.onChatMessage?.(chatMessage);
            } catch (error) {
              err('메시지 파싱 실패:', error);
            }
          });
        },
        onStompError: (frame) => {
          err('STOMP 오류:', frame.headers['message'], frame);
          savedHandlers.current?.onError?.(frame);
          setIsConnected(false);
        },
        onWebSocketClose: () => {
          log('🔌 연결 종료');
          clientInstance = null;
          setIsConnected(false);
        },
      });
      client.activate();
      clientInstance = client;
    } else {
       // 이미 인스턴스가 있으면 연결 상태만 업데이트
      setIsConnected(clientInstance.connected);
    }

    return () => {
      activeSubscriptions--;
      if (activeSubscriptions === 0 && clientInstance) {
        log('모든 구독 해제, 연결 종료');
        clientInstance.deactivate();
        clientInstance = null;
        setIsConnected(false);
      }
    };
  }, [userData]);

  const sendMessage = useCallback((receiverId: number, content: string) => {
    if (!clientInstance?.connected) {
      err('메시지 전송 실패: 클라이언트 미연결');
      return;
    }
    const payload = {
      receiverId,
      content,
    };
    clientInstance.publish({
      destination: '/publish/chat/send',
      body: JSON.stringify(payload),
    });
    log('📤 메시지 발신:', payload);
  }, []);

  return { isConnected, sendMessage };
};
