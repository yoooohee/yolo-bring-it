import { create } from 'zustand';
import type { GameData, Player, Screen } from '@/shared/types/game';

interface GameActions {
  updateGameData: (updates: Partial<GameData>) => void;
  clearGameData: () => void;
  setCurrentScreen: (currentScreen: Screen) => void;
  setGamePhase: (gamePhase: 'loading' | 'countdown' | 'explainIntro' | 'playing' | 'complete') => void;
  getCurrentPlayer: () => Player | undefined;
  getPlayerById: (playerId: string) => Player | undefined;
  getCurrentScreen: () => Screen;
  isLastRound: () => boolean;
}

const initialState: GameData = {
  currentRound: 1,
  roundIdx: 0,
  totalRounds: 0,
  players: [],
  roundResults: [],
  gameType: undefined,
  gameCode: undefined,
  gameName: undefined,
  gameDescription: undefined,
  gameInstruction: undefined,
  keywords: undefined,
  targetColor: undefined,
  gameIcon: undefined,
  gameRules: undefined,
  roomId: null,
  timeLimit: 0,
  startAt: 0,
  gamePhase: 'loading',
  currentScreen: 'landing'
};

export const useGameStore = create<GameData & GameActions>()((set, get) => ({
  ...initialState,

  updateGameData: (updates: Partial<GameData>) => {
    set((state) => ({ ...state, ...updates }));
  },

  setCurrentScreen: (currentScreen: Screen) => {
    set((state) => ({ ...state, currentScreen }));
  },

  setGamePhase: (gamePhase: 'loading' | 'countdown' | 'explainIntro' | 'playing' | 'complete') => {
    set((state) => ({ ...state, gamePhase }));
  },

  clearGameData: () => {
    set(initialState);
  },

  getCurrentPlayer: () => {
    const state = get();
    return state.players?.find((p) => p.isCurrentUser);
  },

  getCurrentScreen: () => {
    const state = get();
    return state.currentScreen;
  },

  getPlayerById: (playerId: string) => {
    const state = get();
    return state.players?.find((p) => p.id === playerId);
  },

  isLastRound: () => {
    const state = get();
    return state.currentRound >= state.totalRounds;
  },
}));