import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useUserLoginStore } from '@/app/stores/userStore';
import { useFriendStore } from '@/app/stores/friendStore';
import apiClient from '@/shared/services/api'; // apiClient import
import { toast } from 'sonner';
import { useWebSocketStore } from '@/app/stores/websocketStore';

// user-service의 웹소켓 엔드포인트
const USER_SOCKET_URL = 'https://i13c207.p.ssafy.io/ws-user';

export const useUserWebSocket = () => {
  const { userData } = useUserLoginStore();
  const { setFriends, setFriendOnline, setFriendOffline, addFriend, addRequest } = useFriendStore();
  const { userClient, setUserClient, setIsUserConnected } = useWebSocketStore();
  const isConnecting = useRef(false); // 연결 시도 중 상태를 관리하기 위한 ref

  useEffect(() => {
    const fetchFriends = async () => {
      if (!userData?.accessToken || !userData?.memberUid) return;
      try {
        console.log('📡 친구 목록 및 온라인 상태 API 호출 시작 (로그인 시)...');
        const friendsResponse = await apiClient.get('/users/friends', {
          headers: {
            'Authorization': `Bearer ${userData.accessToken}`,
          },
        });

        console.log('[검증 1] /users/friends API 응답:', friendsResponse.data.data);

        if (!friendsResponse.data?.data || friendsResponse.data.data.length === 0) {
          setFriends([]);
          return;
        }
        
        const basicFriendsData = friendsResponse.data.data;
        const memberIds = basicFriendsData.map((friend: any) => friend.memberId);

        if (memberIds.length > 0) {
          const membersInfoResponse = await apiClient.post('/users/users/active-member-info-map', memberIds, {
            headers: {
              'Authorization': `Bearer ${userData.accessToken}`,
            },
          });

          const membersInfoMap = membersInfoResponse.data.data;
          console.log('[검증 2] /users/users/active-member-info-map API 응답:', membersInfoMap);

          const detailedFriendsData = basicFriendsData.map((friend: any) => {
            const memberInfo = membersInfoMap[friend.memberId];
            const finalFriendObject = {
              friendUid: friend.friendUid,
              memberId: friend.memberId,
              isAccepted: friend.isAccepted,
              online: friend.online,
              nickname: memberInfo ? memberInfo.nickname : `친구 (ID: ${friend.memberId})`,
              char2dpath: memberInfo ? `https://api.dicebear.com/8.x/pixel-art/svg?seed=${memberInfo.nickname}` : undefined,
            };
            return finalFriendObject;
          });
          
          console.log('[검증 3] setFriends에 전달될 최종 데이터:', detailedFriendsData);
          setFriends(detailedFriendsData as any);
          console.log('✅ 친구 목록 초기화 성공 (로그인 시):', detailedFriendsData);
        } else {
          setFriends([]);
        }
      } catch (error) {
        console.error('❌ 친구 목록 불러오기 실패 (로그인 시):', error);
        toast.error('친구 목록을 불러오는 데 실패했습니다.');
      }
    };

    fetchFriends();
  }, [userData?.accessToken, userData?.memberUid, setFriends]);

  useEffect(() => {
    const connectWebSocket = async () => {
      if (!userData?.accessToken || !userData?.memberUid) {
        if (userClient?.active) {
          console.log('🛑 [FriendSocket] 연결 해제 (로그아웃)');
          userClient.deactivate();
          setUserClient(null);
        }
        return;
      }

      if (userClient?.active || isConnecting.current) {
        console.log('🟡 [FriendSocket] 이미 연결되어 있거나 연결 시도 중입니다.');
        return;
      }

      isConnecting.current = true;
      let client: Client | null = null;

      try {
        console.log('🛡️ [FriendSocket] 웹소켓 연결 전 토큰 유효성 검사...');
        await apiClient.get('/users/users/health-check');
        console.log('✅ [FriendSocket] 토큰 유효성 확인 완료.');

        const freshUserData = useUserLoginStore.getState().userData;
        if (!freshUserData?.accessToken) {
          console.error('🔴 [FriendSocket] 유효한 토큰이 없어 연결을 중단합니다.');
          isConnecting.current = false;
          return;
        }

        client = new Client({
          webSocketFactory: () => new SockJS(USER_SOCKET_URL, null, { transports: ['websocket'] }),
          connectHeaders: {
            Authorization: `Bearer ${freshUserData.accessToken}`,
          },
          debug: (msg) => console.log('📢 [FriendSocket] STOMP Debug:', msg),
          reconnectDelay: 5000,
          onConnect: () => {
            console.log('✅ [UserSocket] user-service 웹소켓 연결 성공');
            setIsUserConnected(true);
            isConnecting.current = false; // 연결 성공 시 플래그 초기화

            // 1. 친구 온라인 상태 변경 구독
            client?.subscribe('/topic/friends/online-status', (message) => {
              try {
                const statusUpdate = JSON.parse(message.body);
                console.log('🔔 [UserSocket] 친구 상태 변경 수신:', statusUpdate);
                if (statusUpdate.memberId === userData?.memberUid) return;
                if (statusUpdate.isOnline) {
                  setFriendOnline(statusUpdate.memberId);
                } else {
                  setFriendOffline(statusUpdate.memberId);
                }
              } catch (error) {
                console.error('[UserSocket] 친구 상태 메시지 파싱 실패:', error);
              }
            });

            // 2. 업적 달성, 친구 요청/수락 등 개인 알림 구독
            if (freshUserData?.memberUid) {
              // 업적 구독
              client?.subscribe(`/topic/achievement/${freshUserData.memberUid}`, (message) => {
                try {
                  const achievement = JSON.parse(message.body);
                  console.log('🏆 [UserSocket] 업적 달성 알림 수신:', achievement);
                  toast.success(`✨ 업적 달성: ${achievement.achievementName} (+${achievement.achievementExp} EXP)`);
                } catch (error) {
                  console.error('[UserSocket] 업적 알림 메시지 파싱 실패:', error);
                }
              });

              // 친구 관련 구독
              client?.subscribe(`/topic/friends/${freshUserData.memberUid}`, (message) => {
                try {
                  const data = JSON.parse(message.body);
                  console.log('💌 [UserSocket] 친구 관련 알림 수신:', data);

                  if (data.message?.includes('님이 친구 요청을 보냈습니다.')) {
                    // 새로운 친구 요청
                    toast.info(`💌 ${data.senderNickname}님으로부터 친구 요청!`);
                    addRequest({
                      id: data.senderId, // 백엔드에서 friendshipId가 따로 오지 않으므로 senderId를 임시 id로 사용
                      memberId: data.senderId,
                      nickname: data.senderNickname,
                      avatarUrl: `https://api.dicebear.com/8.x/pixel-art/svg?seed=${data.senderNickname}`,
                      sentAt: new Date().toISOString(),
                    });
                  } else if (data.message?.includes('님이 친구 요청을 수락했습니다.')) {
                    // 친구 요청 수락됨
                    toast.success(`🎉 ${data.senderNickname}님과 친구가 되었습니다!`);
                    addFriend({
                      friendUid: data.senderId,
                      memberId: data.senderId,
                      nickname: data.senderNickname,
                      avatarUrl: `https://api.dicebear.com/8.x/pixel-art/svg?seed=${data.senderNickname}`,
                      status: 'online', // 온라인으로 가정
                    });
                  }
                } catch (error) {
                  console.error('[UserSocket] 친구 관련 알림 처리 실패:', error);
                }
              });
            }
          },
          onStompError: (frame) => {
            console.error('🔴 [UserSocket] STOMP 에러:', frame.headers['message'], frame);
            setIsUserConnected(false);
            isConnecting.current = false; // 에러 시 플래그 초기화
          },
          onWebSocketClose: () => {
            console.log('🔌 [UserSocket] 연결 종료');
            setIsUserConnected(false);
            isConnecting.current = false; // 연결 종료 시 플래그 초기화
          },
        });

        console.log('🚀 [FriendSocket] 웹소켓 활성화 시도...');
        client.activate();
        setUserClient(client);
      } catch (error) {
        console.error('🔴 [FriendSocket] 토큰 검증 또는 웹소켓 연결 과정에서 에러 발생:', error);
        isConnecting.current = false; // 예외 발생 시 플래그 초기화
      }
    };

    connectWebSocket();

    return () => {
      // Unmount 시 연결 시도 중이었다면 중단
      if (isConnecting.current && userClient) {
        console.log('📴 [FriendSocket] 컴포넌트 언마운트로 연결 시도 중단');
        userClient.deactivate();
        setUserClient(null);
        isConnecting.current = false;
      }
    };
  }, [
    userData?.accessToken, // 의존성 추가
    userData?.memberUid,
    userClient, // userClient도 의존성에 추가
    setUserClient,
    setIsUserConnected,
    setFriendOnline,
    setFriendOffline,
    addFriend,
    addRequest,
  ]);
};