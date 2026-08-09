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

  const fetchAnalytics = () => {
    fetch("/api/analytics", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchAnalytics();
    
    fetch("/api/system-status")
      .then(res => res.json())
      .then(data => setSysStatus(data))
      .catch(console.error);

    const interval = setInterval(fetchAnalytics, 1500);

    const socket = io(window.location.origin);
    socket.on("simulation_tick", (data: any) => {
      setStats((prev: any) => ({
        ...prev,
        currentRiskScore: data.riskScore,
        activeAlerts: data.bottlenecks?.length || 0,
        bottlenecks: data.bottlenecks || [],
        riskTimeline: data.riskTimeline || prev?.riskTimeline || [],
        gateUtilization: data.exitUtilization || prev?.gateUtilization || {},
        reroutedAgents: data.stats?.rerouted || prev?.reroutedAgents || 0,
        activeAgents: data.activeAgents,
        exitedAgents: data.stats?.exited || prev?.exitedAgents || 0
      }));
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [token]);

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 mt-6">
        <Card className="col-span-2 bg-card rounded-xl border border-border shadow-inner">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Real-time system health check</CardDescription>
          </CardHeader>
          <CardContent>
            {sysStatus ? (
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span>Simulation Engine</span>
                  <span className="font-mono">{sysStatus.simulationEngine}</span>
                </div>
                <div className="flex justify-between">
                  <span>WebSocket</span>
                  <span className="font-mono">{sysStatus.websocket}</span>
                </div>
                <div className="flex justify-between">
                  <span>Supabase</span>
                  <span className="font-mono">{sysStatus.supabase}</span>
                </div>
                <div className="flex justify-between">
                  <span>CrowdHuman Dataset</span>
                  <span className="font-mono">{sysStatus.dataset}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hugging Face</span>
                  <span className="font-mono">{sysStatus.huggingface}</span>
                </div>
              </div>
            ) : (
              <div className="animate-pulse">Loading status...</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-5 bg-card rounded-xl border border-border shadow-inner">
          <CardHeader>
            <CardTitle>Architecture Diagram</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg font-mono text-sm space-y-3">
              <div className="bg-primary/20 text-primary px-4 py-2 rounded shadow-sm w-56 text-center border border-primary/50">Frontend (React/Vite)</div>
              <div className="text-muted-foreground">↓</div>
              <div className="bg-blue-500/20 text-blue-500 px-4 py-2 rounded shadow-sm w-56 text-center border border-blue-500/50">Express Backend Server</div>
              <div className="text-muted-foreground">↓</div>
              <div className="bg-orange-500/20 text-orange-500 px-4 py-2 rounded shadow-sm w-56 text-center border border-orange-500/50">Simulation Engine (Node / Dijkstra)</div>
              <div className="flex space-x-12">
                 <div className="flex flex-col items-center">
                   <div className="text-muted-foreground mb-3">↙</div>
                   <div className="bg-green-500/20 text-green-500 px-4 py-2 rounded shadow-sm w-44 text-center border border-green-500/50">Supabase (PostgreSQL)</div>
                 </div>
                 <div className="flex flex-col items-center">
                   <div className="text-muted-foreground mb-3">↘</div>
                   <div className="bg-purple-500/20 text-purple-500 px-4 py-2 rounded shadow-sm w-44 text-center border border-purple-500/50">Hugging Face Model</div>
                 </div>
              </div>
              <div className="text-muted-foreground">↓</div>
              <div className="bg-foreground/10 text-foreground px-4 py-2 rounded shadow-sm w-56 text-center border border-border">Live Analytics Telemetry</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
