import { create } from 'zustand';

interface AutoPlayState {
  isAutoPlaying: boolean;
  intervalSeconds: number;
  
  setAutoPlaying: (playing: boolean) => void;
  setInterval: (seconds: number) => void;
}

export const useAutoPlayStore = create<AutoPlayState>((set) => ({
  isAutoPlaying: false,
  intervalSeconds: 8,
  
  setAutoPlaying: (playing) => set({ isAutoPlaying: playing }),
  setInterval: (seconds) => set({ intervalSeconds: seconds }),
}));
