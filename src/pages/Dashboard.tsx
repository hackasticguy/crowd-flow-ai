import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Activity, AlertTriangle, Users, MapPin, Navigation } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useStore } from "@/src/lib/store";
import { io } from "socket.io-client";

export default function Dashboard() {
  const { token } = useStore();
  const [stats, setStats] = useState<any>(null);
  const [sysStatus, setSysStatus] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. One-time fetch for base historical stats
    fetch("/api/analytics", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load analytics");
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          // Merge so we don't overwrite any fast websocket ticks that arrived during fetch
          setStats((prev: any) => prev ? { ...data, ...prev } : data);
          setError(null);
        }
      })
      .catch(err => {
        console.error("Analytics fetch error:", err);
        if (isMounted) setError("Failed to connect to backend telemetry.");
      });
    
    // 2. Poll system status infrequently (every 10 seconds)
    const fetchStatus = () => {
      fetch("/api/system-status")
        .then(res => res.json())
        .then(data => {
          if (isMounted) setSysStatus(data);
        })
        .catch(console.error);
    };
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 10000);

    // 3. Authenticated WebSocket Connection for high-frequency telemetry
    const socket = io(window.location.origin, {
      auth: { token }
    });

    socket.on("connect", () => {
      if (isMounted) setError(null);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket error:", err);
    });

    socket.on("simulation_tick", (data: any) => {
      if (isMounted) {
        setStats((prev: any) => ({
          ...prev,
          currentRiskScore: data.riskScore,
          peakRiskScore: Math.max(prev?.peakRiskScore || 0, data.riskScore || 0),
          activeAlerts: data.bottlenecks?.length || 0,
          bottlenecks: data.bottlenecks || [],
          riskTimeline: data.riskTimeline || prev?.riskTimeline || [],
          gateUtilization: data.exitUtilization || prev?.gateUtilization || {},
          reroutedAgents: data.stats?.rerouted || prev?.reroutedAgents || 0,
          activeAgents: data.activeAgents,
          exitedAgents: data.stats?.exited || prev?.exitedAgents || 0
        }));
      }
    });

    return () => {
      isMounted = false;
      clearInterval(statusInterval);
      socket.disconnect();
    };
  }, [token]);

  if (error && !stats) return <div className="flex flex-col items-center justify-center h-full text-destructive"><AlertTriangle className="h-8 w-8 mb-2" />{error}</div>;
  if (!stats) return <div className="flex items-center justify-center h-full"><div className="animate-pulse">Loading Live Analytics...</div></div>;

  const chartData = (stats.riskTimeline && stats.riskTimeline.length > 0)
    ? stats.riskTimeline.map((item: any, idx: number) => ({
        time: item.timestamp ? `${Math.round(item.timestamp / 1000)}s` : `#${idx + 1}`,
        crowdDensity: Math.round((item.crowdDensity || 0) * 10),
        risk: Math.round(item.riskScore || 0)
      }))
    : [
        { time: "0s", crowdDensity: stats.activeAgents || 0, risk: stats.currentRiskScore || 0 }
      ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">System Overview</h2>
        <p className="text-muted-foreground">Real-time crowd intelligence and simulation telemetry.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card rounded-xl border border-border shadow-inner">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Risk Score</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.currentRiskScore > 70 ? 'text-destructive' : stats.currentRiskScore > 40 ? 'text-orange-500' : 'text-emerald-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{Math.round(stats.currentRiskScore || 0)}%</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
              Peak: {Math.round(stats.peakRiskScore || stats.currentRiskScore || 0)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card rounded-xl border border-border shadow-inner">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rerouted Agents</CardTitle>
            <Navigation className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-pink-400">{stats.reroutedAgents || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
              AI Reroutes Executed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card rounded-xl border border-border shadow-inner">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Bottlenecks</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.activeAlerts || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Congested Nodes</p>
          </CardContent>
        </Card>

        <Card className="bg-card rounded-xl border border-border shadow-inner">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active / Exited</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.activeAgents || 0} / {stats.exitedAgents || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Live Agents / Exited</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-card rounded-xl border border-border shadow-inner">
          <CardHeader>
            <CardTitle>Crowd Density & Risk Timeline</CardTitle>
            <CardDescription>Live simulation telemetry recorded during execution.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCrowd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="risk" name="Risk Score (%)" stroke="hsl(var(--destructive))" strokeWidth={3} fillOpacity={1} fill="url(#colorRisk)" />
                <Area type="monotone" dataKey="crowdDensity" name="Density (x10)" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorCrowd)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="col-span-3 bg-card rounded-xl border border-border shadow-inner">
          <CardHeader>
            <CardTitle>Gate Utilization</CardTitle>
            <CardDescription>Calculated from live node occupancy / capacity ratio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 mt-4">
              {stats.gateUtilization && Object.keys(stats.gateUtilization).length > 0 ? (
                Object.entries(stats.gateUtilization).map(([gate, value]: [string, any]) => (
                  <div key={gate} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-300">{gate}</span>
                      <span className="text-muted-foreground font-mono">{value}% Cap</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${value > 80 ? 'bg-destructive' : value > 50 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground italic">No gate telemetry available. Start a simulation to view live flow.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 mt-6">
        <Card className="col-span-7 bg-card rounded-xl border border-border shadow-inner">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Real-time system health check</CardDescription>
          </CardHeader>
          <CardContent>
            {sysStatus ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <span className="text-muted-foreground">Simulation Engine</span>
                  <span className="font-mono font-medium">{sysStatus.simulationEngine}</span>
                </div>
                <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <span className="text-muted-foreground">WebSocket</span>
                  <span className="font-mono font-medium">{sysStatus.websocket}</span>
                </div>
                <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <span className="text-muted-foreground">Supabase</span>
                  <span className="font-mono font-medium">{sysStatus.supabase}</span>
                </div>
                <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <span className="text-muted-foreground">CrowdHuman Dataset</span>
                  <span className="font-mono font-medium">{sysStatus.dataset}</span>
                </div>
                <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <span className="text-muted-foreground">Hugging Face</span>
                  <span className="font-mono font-medium">{sysStatus.huggingface}</span>
                </div>
              </div>
            ) : (
              <div className="animate-pulse flex space-x-4">
                 <div className="h-16 bg-muted rounded w-full"></div>
                 <div className="h-16 bg-muted rounded w-full"></div>
                 <div className="h-16 bg-muted rounded w-full"></div>
                 <div className="h-16 bg-muted rounded w-full"></div>
                 <div className="h-16 bg-muted rounded w-full"></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
