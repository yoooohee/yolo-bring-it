import { create } from "zustand";

interface RoomState {
  roomUid: number | null;
  roundNum: number;
  currentRound: number;
}

interface RoomActions {
  setRoomUid: (uid: number) => void;
  setRoundNum: (num: number) => void;
  setCurrentRound: (round: number) => void;
  clearRoom: () => void;
}

const initialState: RoomState = {
  roomUid: null,
  roundNum: 0,
  currentRound: 0,
};

export const useRoomStore = create<RoomState & RoomActions>((set) => ({
  ...initialState,

  setRoomUid: (uid: number) => {
    set({ roomUid: uid });
  },

  setRoundNum: (num: number) => {
    set({ roundNum: num });
  },

  setCurrentRound: (round: number) => {
    set({ currentRound: round });
  },

  clearRoom: () => {
    set(initialState);
  },
}));