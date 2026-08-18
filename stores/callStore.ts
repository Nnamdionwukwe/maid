import { create } from "zustand";

export interface CallData {
  booking_id: string;
  channel: string;
  token: string;
  app_id: string;
  caller_name: string;
}

interface CallStore {
  incomingCall: CallData | null;
  isProcessing: boolean;
  setIncomingCall: (call: CallData | null) => void;
  clearIncomingCall: () => void;
  setProcessing: (val: boolean) => void;
}

export const useCallStore = create<CallStore>((set) => ({
  incomingCall: null,
  isProcessing: false,
  setIncomingCall: (call) => set({ incomingCall: call }),
  clearIncomingCall: () => set({ incomingCall: null, isProcessing: false }),
  setProcessing: (val) => set({ isProcessing: val }),
}));
