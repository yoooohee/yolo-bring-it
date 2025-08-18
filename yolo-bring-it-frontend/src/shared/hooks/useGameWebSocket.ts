import { useEffect, useRef, useCallback } from 'react';
import { useWebSocketStore } from '@/app/stores/websocketStore';
import { IMessage, StompSubscription } from '@stomp/stompjs';

interface GameSocketConfig {
  roomId?: number;
  onParticipantEvent?: (data: any) => void; // JOINED, LEFT
  onRosterChange?: (data: any) => void; // Full participant list
  onReadyStatus?: (data: any) => void;
  onCanStart?: (data: any) => void;
  onChatMessage?: (data: any) => void;
  onGameStart?: (data: any) => void; // GAME_START
  onRoundIntro?: (data: any) => void; // ROUND_INTRO
  onRoundEnd?: (data: any) => void; // ROUND_ENDED
  onGameScore?: (data: any) => void;
  onError?: (error: any) => void;
}

type Sub = StompSubscription | null;

const now = () => new Date().toISOString().split('T')[1]!.replace('Z', '');
const tag = 'GameSocket';
const log = (...args: any[]) => console.log(`[${now()}] [${tag}]`, ...args);
const warn = (...args: any[]) => console.warn(`[${now()}] [${tag}] ⚠️`, ...args);
const err = (...args: any[]) => console.error(`[${now()}] [${tag}] ❌`, ...args);

function safeJSON<T = any>(body: string, where: string): T | null {
  try {
    return JSON.parse(body) as T;
  } catch (e) {
    err(`JSON parse 실패 @${where}:`, e, '\n원본:', body);
    return null;
  }
}

function makeTopic(roomId: number, path: string) {
  return `/topic/${path.replace(':roomId', String(roomId))}`;
}

export const useGameWebSocket = (config?: GameSocketConfig) => {
  const { roomId } = config || {};
  const { client, isConnected } = useWebSocketStore();
  const savedHandlers = useRef(config);
  const subsRef = useRef<Sub[]>([]);
  const processedRounds = useRef<Set<number>>(new Set()); // 처리된 라운드 추적

  // 최신 핸들러 유지
  useEffect(() => {
    savedHandlers.current = config;
  }, [config]);

  // 구독/해제 유틸
  const unsubscribeAll = useCallback((reason: string) => {
    if (!subsRef.current?.length) return;
    log(`🧹 구독 해제(${reason}) - count=${subsRef.current.length}`);
    subsRef.current.forEach((s) => {
      try { s?.unsubscribe(); } catch (e) { warn('구독 해제 중 오류:', e); }
    });
    subsRef.current = [];
  }, []);

  const subscribe = useCallback((destination: string, handler: (msg: IMessage) => void) => {
    if (!client) {
      warn('subscribe 실패: client 없음', destination);
      return null;
    }
    try {
      log('🔔 SUB', destination);
      const sub = client.subscribe(destination, handler);
      subsRef.current.push(sub);
      return sub;
    } catch (e) {
      err('SUB 실패:', destination, e);
      savedHandlers.current?.onError?.(e);
      return null;
    }
  }, [client]);

  // 메인 구독 effect
  useEffect(() => {
    // 연결 가드
    if (!client) { log('⏸️ 대기: client 없음'); return; }
    if (!isConnected || !client.connected) { log('⏸️ 대기: STOMP 미연결'); return; }
    if (!roomId) { log('⏸️ 대기: roomId 없음'); return; }

    log(`✅ 구독 시작 (roomId=${roomId}) connected=${client.connected}`);

    // 중복 구독 방지(이전 구독 모두 해제)
    //unsubscribeAll('re-subscribe');

    const cfg = savedHandlers.current;

    // --- 구독 세트 ---
    // ✅ 대기방 관련
    if (cfg?.onParticipantEvent) {
      subscribe(makeTopic(roomId, 'room/:roomId/participants'), (msg) => {
        const data = safeJSON(msg.body, 'participants');
        if (!data) return;
        log('👥 participants event:', data);
        cfg?.onParticipantEvent?.(data);
      });
    }

    if (cfg?.onRosterChange) {
      subscribe(makeTopic(roomId, 'room/:roomId/roster'), (msg) => {
        const data = safeJSON(msg.body, 'roster');
        if (!data) return;
        log('🧾 roster:', data);
        cfg?.onRosterChange?.(data);
      });
    }

    if (cfg?.onReadyStatus) {
      subscribe(makeTopic(roomId, 'room/:roomId/ready'), (msg) => {
        const data = safeJSON(msg.body, 'ready');
        if (!data) return;
        log('🟡 ready:', data);
        cfg?.onReadyStatus?.(data);
      });
    }

    if (cfg?.onCanStart) {
      subscribe(makeTopic(roomId, 'room/:roomId/can-start'), (msg) => {
        const data = safeJSON(msg.body, 'can-start');
        if (!data) return;
        log('✅ can-start:', data);
        cfg?.onCanStart?.(data);
      });
    }

    // ✅ 채팅 관련
    if (cfg?.onChatMessage) {
      subscribe(makeTopic(roomId, 'room/:roomId/chat'), (msg) => {
        const data = safeJSON(msg.body, 'chat');
        if (!data) return;
        log('💬 chat:', data);
        cfg?.onChatMessage?.(data);
      });
    }

    // ✅ 게임 진행 관련 (핵심)
    if (cfg?.onRoundIntro || cfg?.onRoundEnd || cfg?.onGameStart) {
      subscribe(makeTopic(roomId, 'room/:roomId'), (msg) => {
        const data = safeJSON(msg.body, 'room-event');
        if (!data || !data.type) return;

        switch (data.type) {
          case 'ROUND_INTRO':
            log('🎮 game/round-intro:', data);
            // 라운드 인트로는 중복 방지 없이 처리 (항상 새로운 라운드)
            processedRounds.current.clear(); // 새 라운드 시작시 처리된 라운드 초기화
            cfg?.onRoundIntro?.(data);
            break;
          case 'ROUND_ENDED':
            log('🏁 game/round-end:', data, data.roundIdx);
            const roundIdx = data.roundIdx;
            //if (roundIdx !== undefined && !processedRounds.current.has(roundIdx)) {
            if (roundIdx !== undefined) {
              processedRounds.current.add(roundIdx);
              log(`✅ 라운드 ${roundIdx} 종료 처리 (첫 번째 호출)`);
              cfg?.onRoundEnd?.(data);
            } else {
              log(`⚠️ 라운드 ${roundIdx} 종료 중복 호출 무시`);
            }
            break;
          default:
            // JOINED, LEFT 등 다른 이벤트는 이미 participants 토픽에서 처리되므로 여기선 무시
            break;
        }
      });
    }

    // ✅ 게임 점수 관련
    if (cfg?.onGameScore) {
      subscribe(makeTopic(roomId, 'room/:roomId/score'), (msg) => {
        const data = safeJSON(msg.body, 'game/score');
        if (!data) return;
        log('📈 game/score:', data);
        cfg?.onGameScore?.(data);
      });
    }

    // 클린업
    return () => {
      //unsubscribeAll('effect-cleanup');
      log(`📴 구독 종료 (roomId=${roomId})`);
    };
  }, [client, isConnected, roomId, subscribe, unsubscribeAll, config]);

  // 퍼블리시 공통 유틸(로깅 + 가드)
  const publish = useCallback((destination: string, body: any) => {
    if (!client) { warn('PUB 실패: client 없음', destination); return; }
    if (!client.connected) { warn('PUB 실패: STOMP 미연결', destination); return; }
    log('📤 PUB', destination, body);
    try {
      client.publish({ destination, body: JSON.stringify(body) });
    } catch (e) {
      err('PUB 예외:', destination, e);
      savedHandlers.current?.onError?.(e);
    }
  }, [client]);

  // === 외부로 노출: 동일 API (로깅 보강) ===
  const sendMessage = useCallback((message: string) => {
    if (!roomId) { warn('sendMessage: roomId 없음'); return; }
    publish(`/pub/chat/${roomId}`, { roomId, content: message });
  }, [publish, roomId]);

  const sendGameStart = useCallback((gameType: string) => {
    if (!roomId) { warn('sendGameStart: roomId 없음'); return; }
    publish(`/pub/game/${roomId}/start`, { gameType });
  }, [publish, roomId]);

  const sendGameScore = useCallback((gameCode: number, score: number) => {
    if (!roomId) { warn('sendGameScore: roomId 없음'); return; }
    publish(`/pub/game/${roomId}/score`, { gameCode, score });
  }, [publish, roomId]);

  const sendGameEnd = useCallback((gameCode: string, result: string, finalScore: number) => {
    if (!roomId) { warn('sendGameEnd: roomId 없음'); return; }
    publish(`/pub/game/${roomId}/end`, { gameCode, result, finalScore });
  }, [publish, roomId]);

  const sendYoloUp = useCallback((targetMemberId: number) => {
    if (!roomId) { warn('sendYoloUp: roomId 없음'); return; }
    publish(`/pub/game/${roomId}/yolo`, { type: 'UP', targetMemberId });
  }, [publish, roomId]);

  const sendYoloDown = useCallback((targetMemberId: number) => {
    if (!roomId) { warn('sendYoloDown: roomId 없음'); return; }
    publish(`/pub/game/${roomId}/yolo`, { type: 'DOWN', targetMemberId });
  }, [publish, roomId]);

  return {
    isConnected,
    sendMessage,
    sendGameStart,
    sendGameScore,
    sendGameEnd,
    sendYoloUp,
    sendYoloDown,
  };
};