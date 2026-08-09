import { create } from "zustand";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null, token: string | null) => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  setUser: (user, token) => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },
}));
