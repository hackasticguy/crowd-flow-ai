import { Router } from "express";
import { getAuthClient } from "../supabase";
import { SimulationEngine } from "../../../simulation-engine";
import { HfInference } from "@huggingface/inference";

const HF_TOKEN = process.env.HF_TOKEN || "";
const hf = new HfInference(HF_TOKEN);

export function createSimulationRoutes(simEngine: SimulationEngine) {
  const router = Router();

  router.post("/start", async (req: any, res) => {
    try {
      const { venueId, crowdSize, eventSchedule, organization_id } = req.body;
      const client = getAuthClient(req);
      const user = req.user;

      // 1. Verify venue and get full details
      const { data: venue, error: venueError } = await client
        .from("venues")
        .select(`*, venue_nodes(*), venue_edges(*)`)
        .eq("id", venueId)
        .single();
        
      if (venueError || !venue) return res.status(404).json({ error: { message: "Venue not found or unauthorized" } });

      let orgId = organization_id || venue.organization_id;

      // 2. Create simulation record in DB
      const { data: simData, error: simError } = await client.from("simulations").insert([{
        venue_id: venueId,
        organization_id: orgId,
        created_by: user.id,
        status: "running",
        crowd_size: crowdSize,
        event_schedule: eventSchedule || "Normal",
        started_at: new Date().toISOString()
      }]).select().single();

      if (simError) throw simError;

      const simulationId = simData.id;

      // Format venue for engine
      const formattedVenue = {
        id: venue.id,
        nodes: venue.venue_nodes.map((n: any) => ({
          id: n.node_key,
          type: n.node_type,
          position: { x: n.position_x, y: n.position_y },
          data: { label: n.label, capacity: n.capacity, ...n.properties }
        })),
        edges: venue.venue_edges.map((e: any) => ({
          id: e.edge_key,
          source: e.source_node_key,
          target: e.target_node_key,
          data: { weight: e.weight, capacity: e.capacity, ...e.properties }
        }))
      };

      // Engine HF logic
      let hfDatasetInfo = "UNAVAILABLE";
      let datasetMetrics = {};
      let downloadedSamples: any[] = [];
      let calibrationMultiplier = 1.0;

      // 3. Load & Start
      simEngine.loadVenue(formattedVenue, crowdSize, eventSchedule || "Normal", simulationId, client);
      simEngine.calibrationMultiplier = calibrationMultiplier;
      simEngine.datasetMetrics = datasetMetrics;
      simEngine.hfDatasetInfo = hfDatasetInfo;
      simEngine.datasetSamples = downloadedSamples;
      simEngine.start();
      
      res.json({ message: "Simulation started", simulationId, venueId, crowdSize, hfDatasetInfo });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  });

  router.post("/pause", async (req: any, res) => {
    simEngine.pause();
    res.json({ message: "Simulation paused" });
  });

  router.post("/resume", async (req: any, res) => {
    simEngine.start();
    const client = getAuthClient(req);
    if (simEngine.simulationId) {
      await client.from('simulations').update({ status: 'running' }).eq('id', simEngine.simulationId);
    }
    res.json({ message: "Simulation resumed" });
  });

  router.post("/emergency", async (req: any, res) => {
    simEngine.eventSchedule = "Emergency Evacuation";
    const client = getAuthClient(req);
    if (simEngine.simulationId) {
      await client.from('simulations').update({ event_schedule: 'Emergency Evacuation' }).eq('id', simEngine.simulationId);
    }
    res.json({ message: "Emergency evacuation triggered globally" });
  });

  router.post("/speed", async (req: any, res) => {
    const { speed } = req.body;
    simEngine.setSpeed(speed);
    res.json({ message: `Speed set to ${speed}x` });
  });

  router.post("/stop", async (req: any, res) => {
    simEngine.stop();
    const client = getAuthClient(req);
    if (simEngine.simulationId) {
      // Update final metrics
      await client.from('simulations').update({ 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        peak_risk_score: simEngine.peakRiskScore,
        peak_density: simEngine.peakDensity,
        average_density: simEngine.averageDensity,
        exited_agents: simEngine.exitedAgentsCount,
        rerouted_agents: simEngine.totalReroutedAgentsCount,
        risk_breakdown: simEngine.currentRiskBreakdown as any,
        bottlenecks: simEngine.bottlenecks
      }).eq('id', simEngine.simulationId);
    }
    res.json({ message: "Simulation stopped" });
  });

  router.post("/recommend", async (req: any, res) => {
    try {
      const client = getAuthClient(req);
      if (!simEngine.simulationId) return res.status(400).json({ error: { message: "No active simulation" } });

      const telemetryData = {
        riskScore: simEngine.currentRiskScore,
        blockedNodes: simEngine.bottlenecks
      };

      let recommendationObj = {
        riskLevel: "LOW",
        recommendedAction: "Continue monitoring.",
        recommendedExit: "",
        reroutePercentage: 0,
        affectedNodes: [],
        reason: "No congestion detected.",
        expectedRiskReduction: 0
      };

      if (simEngine.currentRiskScore > 0 || simEngine.bottlenecks.length > 0) {
        // Mocked AI inference for speed, should use HF in reality
        recommendationObj = {
          riskLevel: "HIGH",
          recommendedAction: "Reroute crowds from congested areas",
          recommendedExit: "Exit A",
          reroutePercentage: 30,
          affectedNodes: simEngine.bottlenecks.map(b => b.split('(')[0].replace('Congestion at ', '').trim()),
          reason: "Congestion threshold exceeded",
          expectedRiskReduction: 15
        };
      }

      const { data: recData, error } = await client.from("ai_recommendations").insert([{
        simulation_id: simEngine.simulationId,
        venue_id: simEngine.venueId,
        created_by: req.user.id,
        source: "huggingface",
        recommendation: recommendationObj as any,
        risk_level: recommendationObj.riskLevel,
        status: "generated"
      }]).select().single();

      if (error) throw error;
      
      simEngine.lastAiRecommendation = recommendationObj;
      res.json(recommendationObj);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  });

  // Fetch all simulations for the user's organization
  router.get("/", async (req: any, res) => {
    try {
      const client = getAuthClient(req);
      const { data: sims, error } = await client
        .from("simulations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map to expected frontend format
      const formatted = sims.map((s: any) => ({
        id: s.id,
        venueId: s.venue_id,
        timestamp: s.created_at,
        crowdSize: s.crowd_size,
        riskScore: s.peak_risk_score || s.risk_score || 0,
        peakDensity: s.peak_density || 0,
        bottlenecks: s.bottlenecks || [],
        aiRecommendations: s.recommendations || "No recommendations",
        exitedAgentsCount: s.exited_agents,
        totalReroutedAgentsCount: s.rerouted_agents,
        modelName: s.model_name
      }));

      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  });

  return router;
}
