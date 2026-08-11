import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "@/src/lib/store";
import { LayoutDashboard, Map, Activity, FileText, Settings, LogOut } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function Layout() {
  const { user, logout, token } = useStore();
  const [emergencyTriggered, setEmergencyTriggered] = React.useState(false);

  const handleEmergencyReroute = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/simulate/emergency", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEmergencyTriggered(true);
        setTimeout(() => setEmergencyTriggered(false), 2000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const location = useLocation();
  const navigate = useNavigate();

  if (!user) {
    return <Outlet />;
  }

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Venue Builder", path: "/builder", icon: Map },
    { name: "Simulation", path: "/simulation", icon: Activity },
    { name: "Reports", path: "/reports", icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-card border-r border-border flex flex-col z-10 relative">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground">CF</div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            CrowdFlow AI
          </h1>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200",
                location.pathname === item.path
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5 opacity-70" />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-4">
          <div className="bg-muted rounded-lg p-3 border border-border mb-4">
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">AI Model Active</p>
            <p className="text-xs text-muted-foreground">Mistral-7B-v0.2</p>
            <div className="mt-2 w-full bg-secondary h-1 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-3/4"></div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 px-3 py-3 bg-muted rounded-lg mb-4">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-primary font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex items-center space-x-3 px-3 py-2 w-full text-muted-foreground hover:text-destructive transition-colors rounded-md text-sm hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 opacity-70" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-background">
        <header className="h-14 border-b border-border bg-[#0a0a0c] flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
              <span className="text-xs font-medium text-emerald-500">SYSTEM LIVE</span>
            </div>
            <div className="h-4 w-px bg-border"></div>
            <p className="text-xs text-muted-foreground">Venue: <span className="text-foreground">Global Selection</span></p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/reports")}
              className="px-3 py-1.5 text-xs bg-muted border border-border rounded font-medium hover:bg-secondary transition-colors text-foreground cursor-pointer"
            >
              Export Reports
            </button>
            <button 
              onClick={handleEmergencyReroute}
              className={cn(
                "px-3 py-1.5 text-xs cursor-pointer text-primary-foreground rounded font-medium shadow-lg transition-colors",
                emergencyTriggered ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-primary hover:bg-primary/90"
              )}
            >
              {emergencyTriggered ? "Triggered!" : "Emergency Reroute"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto relative p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
