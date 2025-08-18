import { useState, useCallback, useEffect } from 'react';
import { Room, RemoteParticipant } from 'livekit-client';
import { useLiveKit } from './useLiveKit';
import { useLocalWebRTC } from './useLocalWebRTC';

interface UseGameWebRTCReturn {
  // 로컬 WebRTC (내 화면)
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isLocalVideoEnabled: boolean;
  isLocalAudioEnabled: boolean;
  isLocalConnecting: boolean;
  localError: string | null;
  
  // LiveKit (다른 참가자들)
  room: Room | null;
  participants: RemoteParticipant[];
  isLiveKitConnected: boolean;
  isLiveKitConnecting: boolean;
  liveKitError: string | null;
  
  // 컨트롤
  toggleLocalVideo: () => Promise<void>;
  toggleLocalAudio: () => Promise<void>;
  connectToGameRoom: (roomId: string) => Promise<void>;
  leaveGameRoom: () => void;
}

export const useGameWebRTC = (): UseGameWebRTCReturn => {
  const [gameRoomId, setGameRoomId] = useState<string | null>(null);
  
  // 로컬 WebRTC (내 화면용)
  const {
    videoRef: localVideoRef,
    isVideoEnabled: isLocalVideoEnabled,
    isAudioEnabled: isLocalAudioEnabled,
    isConnecting: isLocalConnecting,
    error: localError,
    toggleVideo: toggleLocalVideo,
    toggleAudio: toggleLocalAudio,
  } = useLocalWebRTC();
  
  // LiveKit (다른 참가자들용) - gameRoomId가 설정된 후에만 초기화
  const {
    room,
    remoteParticipants,
    isConnected: isLiveKitConnected,
    isConnecting: isLiveKitConnecting,
    error: liveKitError,
    connectToRoom: connectToLiveKitRoom,
    leaveRoom: leaveLiveKitRoom,
  } = useLiveKit(gameRoomId ? gameRoomId : 'disabled_room');

  const connectToGameRoom = useCallback(async (roomId: string, enableLiveKit = true) => {
    console.log('🎮 게임 룸 WebRTC 연결 시작:', roomId, '/ LiveKit:', enableLiveKit);
    
    // 1. 로컬 비디오 시작
    if (!isLocalVideoEnabled) {
      console.log('📹 로컬 비디오 시작...');
      await toggleLocalVideo();
    }
    
    // 2. LiveKit roomId 설정 (useEffect에서 자동 연결됨)
    if (enableLiveKit) {
      console.log('🌐 LiveKit roomId 설정:', roomId);
      setGameRoomId(roomId);
    } else {
      console.log('⏭️ LiveKit 연결 스킵 (로컬 모드)');
    }
    
    console.log('✅ 게임 룸 WebRTC 연결 완료');
  }, [isLocalVideoEnabled, toggleLocalVideo]);

  // gameRoomId가 변경될 때마다 LiveKit 연결
  useEffect(() => {
    if (gameRoomId && gameRoomId !== '' && gameRoomId !== null) {
      console.log('🔄 gameRoomId 변경 감지, LiveKit 연결 시작:', gameRoomId);
      connectToLiveKitRoom();
    }
  }, [gameRoomId, connectToLiveKitRoom]);

  const leaveGameRoom = useCallback(() => {
    console.log('🚪 게임 룸 WebRTC 연결 해제');
    leaveLiveKitRoom();
    setGameRoomId(null);
  }, [leaveLiveKitRoom]);

  return {
    // 로컬 WebRTC
    localVideoRef,
    isLocalVideoEnabled,
    isLocalAudioEnabled,
    isLocalConnecting,
    localError,
    
    // LiveKit
    room,
    participants: remoteParticipants,
    isLiveKitConnected,
    isLiveKitConnecting,
    liveKitError,
    
    // 컨트롤
    toggleLocalVideo,
    toggleLocalAudio,
    connectToGameRoom,
    leaveGameRoom,
  };
};