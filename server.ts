import "dotenv/config";
import express from "express";
import path from "path";
import { HfInference } from "@huggingface/inference";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { SimulationEngine } from "./simulation-engine";
import { createClient } from "@supabase/supabase-js";
import { CANONICAL_DEMO_VENUE } from "./src/lib/canonicalVenue";
import { venueRoutes } from "./src/server/routes/venues";
import { createSimulationRoutes } from "./src/server/routes/simulations";
import { getAuthClient } from "./src/server/supabase";

// -- Config --
const PORT = process.env.PORT || 3001;
const HF_TOKEN = process.env.HF_TOKEN || ""; // Should be in .env

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";
let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Supabase initialized");
}

// HuggingFace client
const hf = new HfInference(HF_TOKEN);

// -- App Setup --
async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" }
  });

  const simEngine = new SimulationEngine(io, hf);

  app.use(express.json());

  // Middleware to enforce Supabase Authentication
  const requireAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    
    try {
      const client = getAuthClient(req);
      const { data: { user }, error } = await client.auth.getUser(token);
      
      if (error || !user) {
        return res.status(401).json({ error: "Invalid token" });
      }
      
      req.user = user;
      next();
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  app.use("/api/venues", requireAuth, venueRoutes);

  app.use("/api/simulate", requireAuth, createSimulationRoutes(simEngine));

  app.get("/api/analytics", requireAuth, async (req, res) => {
    let totalSimulations = 1;
    let dbAverageRisk = 0;
    
    // Attempt to fetch historical average risk from Supabase if connected
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      try {
        const { getAuthClient } = await import("./src/server/supabase");
        const client = getAuthClient(req as any);
        const { data, error } = await client.from('simulations').select('risk_score');
        if (!error && data && data.length > 0) {
          totalSimulations = data.length;
          dbAverageRisk = data.reduce((acc, curr) => acc + (curr.risk_score || 0), 0) / data.length;
        }
      } catch (e) {}
    }

    const averageRisk = simEngine.currentRiskScore || dbAverageRisk;
    
    // Calculate REAL gate utilization from live simEngine nodes
    const realGateUtilization: Record<string, number> = {};
    if (simEngine.nodes.length > 0) {
      simEngine.nodes.forEach(n => {
        const cat = simEngine.getNodeCategory(n);
        if (cat === 'entry' || cat === 'exit' || cat === 'emergency') {
          const label = n.data?.label || n.id;
          const count = simEngine.nodeOccupancy.get(n.id) || 0;
          const cap = n.data?.capacity || 200;
          realGateUtilization[label] = Math.round((count / cap) * 100);
        }
      });
    } else {
      realGateUtilization["Exit Gate A"] = 0;
      realGateUtilization["Exit Gate B"] = 0;
      realGateUtilization["Emergency Exit"] = 0;
    }

    res.json({
      totalSimulations: totalSimulations,
      averageRisk,
      currentRiskScore: simEngine.currentRiskScore,
      peakRiskScore: simEngine.peakRiskScore,
      activeAlerts: simEngine.bottlenecks.length,
      bottlenecks: simEngine.bottlenecks,
      gateUtilization: realGateUtilization,
      riskTimeline: simEngine.riskTimeline,
      reroutedAgents: simEngine.totalReroutedAgentsCount,
      activeAgents: simEngine.agents.filter(a => a.state !== "EXITED").length,
      exitedAgents: simEngine.exitedAgentsCount,
      lastAiRecommendation: simEngine.lastAiRecommendation,
      aiRecommendationHistory: simEngine.aiRecommendationHistory
    });
  });

  app.get("/api/system-status", async (req, res) => {
    const status: any = {
      simulationEngine: "🟢 Online",
      websocket: "🟢 Connected", // Assumed handled correctly by server presence
      supabase: "🔴 Unavailable",
      dataset: "🔴 Unavailable",
      huggingface: "🔴 Unavailable",
    };

    // Check Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
       status.supabase = "🟢 Connected";
    }

    // Check Dataset
    try {
       const dsRes = await fetch("https://huggingface.co/api/datasets/jamarks/CrowdHuman-train");
       if (dsRes.ok) {
          status.dataset = "🟢 Online";
       }
    } catch(e) {}

    // Check HF
    if (process.env.HF_TOKEN) {
       try {
         const hfRes = await fetch("https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct", {
           headers: { Authorization: "Bearer " + process.env.HF_TOKEN }
         });
         if (hfRes.ok || hfRes.status === 400 || hfRes.status === 503) {
           if (hfRes.status === 503) status.huggingface = "🟡 Loading";
           else status.huggingface = "🟢 Online";
         } else if (hfRes.status === 429) {
           status.huggingface = "🔴 Rate Limited";
         } else {
           status.huggingface = "🔴 Error " + hfRes.status;
         }
       } catch(e) {
         status.huggingface = "🔴 Offline";
       }
    }

    res.json(status);
  });

  app.get("/api/test-hf-connection", async (req, res) => {
    if (!process.env.HF_TOKEN) {
      return res.json({ success: false, error: "HF_TOKEN missing in .env" });
    }
    const startTime = Date.now();
    try {
      const hf = new HfInference(process.env.HF_TOKEN);
      const response = await hf.chatCompletion({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{ role: "user", content: "Test connection" }],
        max_tokens: 10
      });
      
      const latency = Date.now() - startTime;
      
      return res.json({
        success: true,
        status: 200,
        latency,
        model: "Qwen/Qwen2.5-7B-Instruct",
        response: response.choices[0]?.message?.content || "Success"
      });
    } catch (e: any) {
      return res.json({ success: false, error: e.message, latency: Date.now() - startTime });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  } else {
    // Development mode Vite integration
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
