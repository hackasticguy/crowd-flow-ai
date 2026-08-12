import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./supabase";
import { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];

interface User {
  id: string;
  name: string;
  email: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  profile: Profile | null;
  activeOrganization: Organization | null;
  organizations: Organization[];
  isAuthLoaded: boolean;
  
  setUser: (user: User | null, token: string | null) => void;
  setProfile: (profile: Profile | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrganization: (org: Organization | null) => void;
  logout: () => Promise<void>;
  initializeAuth: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      profile: null,
      activeOrganization: null,
      organizations: [],
      isAuthLoaded: false,

      setUser: (user, token) => set({ user, token }),
      setProfile: (profile) => set({ profile }),
      setOrganizations: (organizations) => {
        set({ organizations });
        if (organizations.length > 0 && !get().activeOrganization) {
          set({ activeOrganization: organizations[0] });
        }
      },
      setActiveOrganization: (activeOrganization) => set({ activeOrganization }),
      
      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, token: null, profile: null, activeOrganization: null, organizations: [] });
      },

      initializeAuth: () => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            set({ 
              user: { 
                id: session.user.id, 
                name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User", 
                email: session.user.email || "" 
              }, 
              token: session.access_token,
              isAuthLoaded: true
            });
            // Fetch profile and orgs
            fetchProfileData(session.user.id);
          } else {
            set({ user: null, token: null, isAuthLoaded: true });
          }
        });

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
             set({ 
              user: { 
                id: session.user.id, 
                name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User", 
                email: session.user.email || "" 
              }, 
              token: session.access_token 
            });
            fetchProfileData(session.user.id);
          } else {
            set({ user: null, token: null, profile: null, activeOrganization: null, organizations: [] });
          }
        });
      }
    }),
    {
      name: "crowd-flow-storage",
      partialize: (state) => ({ 
        activeOrganization: state.activeOrganization 
      }), // Only persist what we need locally, Auth is handled by Supabase
    }
  )
);

// Helper to fetch profile and organizations
async function fetchProfileData(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (profile) {
    useStore.getState().setProfile(profile);
  }

  const { data: orgMembers } = await supabase.from('organization_members').select('organization_id').eq('user_id', userId);
  if (orgMembers && orgMembers.length > 0) {
    const orgIds = orgMembers.map(om => om.organization_id);
    const { data: orgs } = await supabase.from('organizations').select('*').in('id', orgIds);
    if (orgs) {
      useStore.getState().setOrganizations(orgs);
    }
  }
}
