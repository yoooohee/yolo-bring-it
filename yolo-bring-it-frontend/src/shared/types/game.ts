export type Screen = "landing" | "login" | "register" | "forgot-password" | "lobby" | "game-join" | "waiting-room" | "game" | "round-result" | "final-result" | "user-settings";

// 게임 타입 정의 (AI 게임 모드들은 제거됨 - 각 게임에 통합됨)
export type GameType = 
  | "bring_object" 
  | "color_similar" 
  | "expression" 
  | "forbidden_word" 
  | "drawing" 
  | "timing_click" 
  | "famous_line" 
  | "quick_press" 
  | "blink" 
  | "headbanging";

// 게임별 특별한 UI 설정 타입
export interface GameSpecialUI {
  // 기존 UI 요소들
  showExpressionTarget?: boolean;
  showMirrorMode?: boolean;
  showEmojiGuide?: boolean;
  showBlinkCounter?: boolean;
  showEyeTracker?: boolean;
  showStaminaBar?: boolean;
  showColorTarget?: boolean;
  showColorPicker?: boolean;
  showFoundItems?: boolean;
  showItemTarget?: boolean;
  showTimer?: boolean;
  showSpeedMeter?: boolean;
  showScriptDisplay?: boolean;
  showAudioWaveform?: boolean;
  showVoiceRecorder?: boolean;
  
  // 새로운 UI 요소들
  showForbiddenWord?: boolean;
  showWordCounter?: boolean;
  showDrawingTarget?: boolean;
  showCanvas?: boolean;
  showScreenTimer?: boolean;
  showMemoryTest?: boolean;
  showCountdown?: boolean;
  showButtonTarget?: boolean;
  showReactionTimer?: boolean;
  showScore?: boolean;
  showMusicBeat?: boolean;
  showRhythmMeter?: boolean;
  showDanceGuide?: boolean;
}

// 게임 타입 배열
export const GAME_TYPES: GameType[] = [
  "bring_object",
  "color_similar",
  "expression",
  "forbidden_word",
  "drawing",
  "timing_click",
  "famous_line",
  "quick_press",
  "blink",
  "headbanging",
];

// 게임별 퍼포먼스 설정
export const PERFORMANCE_CONFIGS: Record<GameType, any> = {
  bring_object: { /* ... */ },
  color_similar: { /* ... */ },
  expression: { /* ... */ },
  forbidden_word: { /* ... */ },
  drawing: { /* ... */ },
  timing_click: { /* ... */ },
  famous_line: { /* ... */ },
  quick_press: { /* ... */ },
  blink: { /* ... */ },
  headbanging: { /* ... */ },
};

// 기본 게임 설정
export const GAME_CONFIG = {
  ROUND_SCORE_MULTIPLIER: 10,
  // 기타 필요한 설정 추가
};

// 게임별 상세 설정 타입
export interface GameConfig {
  title: string;
  description: string;
  instruction: string;
  timeLimit: number;
  timeLimitDisplay: string;
  icon: string;
  color: string;
  specialUI: GameSpecialUI;
  rules: string[];
}

export interface GameData {
  currentRound: number;
  roundIdx: number; // 추가
  totalRounds: number;
  players: Player[];
  roundResults: RoundResult[];
  gameType: string | undefined;
  gameCode: number | undefined; // 추가
  gameName: string | undefined; 
  gameDescription: string | undefined;
  gameInstruction?: string;
  keywords?: { ko: string; en: string; }; // 🧠 추가
  targetColor?: { r: number; g: number; b: number;};
  gameIcon?: string;
  gameRules?: string[];
  roomId: number | null;
  startAt: number;
  timeLimit: number; // 추가
  gamePhase?: 'loading' | 'countdown' | 'explainIntro' | 'playing' | 'complete';
  currentScreen: Screen;
}

export interface GameIntroData {
  currentRound: number;
  gameName: string | undefined;
  gameDescription: string | undefined;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  totalScore: number;
  roundScores: number[];
  isCurrentUser?: boolean;
  isReady?: boolean;
}

export type FriendStatus = 'online' | 'offline' | 'in-game';

export interface Friend {
  friendUid: number;
  memberId: number;
  isAccepted: boolean;
  isOnline: boolean;
  nickname?: string; // 닉네임은 다른 API로 가져와야 할 수 있으므로 optional
  char2dpath?: string; // 아바타 경로도 optional
}

export interface RoundResult {
  round: number;
  gameType: GameType;
  rankings: PlayerRanking[];
}

export interface PlayerRanking {
  playerId: string;
  rank: number;
  score: number;
  performance?: string;
}

export interface ChatMessage {
  id: number;
  user: string;
  message: string;
  timestamp: string;
  type: "system" | "user";
}