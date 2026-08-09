import { Server as SocketIOServer } from "socket.io";
import { HfInference } from "@huggingface/inference";

export interface Node {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: { label: string; capacity?: number; type?: string; description?: string };
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  data?: {
    distance?: number;
    capacity?: number;
    travelTime?: number;
    direction?: string;
  };
}

export interface RiskBreakdown {
  crowdDensity: number;
  queueRatio: number;
  exitUtilization: number;
  blockedPathRatio: number;
  riskScore: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  contributions: {
    crowd: number;
    queue: number;
    exit: number;
    blocked: number;
  };
}

export type AgentIntent = "ENTERING" | "WALKING_TO_AREA" | "FOOD" | "WAITING" | "EXITING" | "EVACUATING";

export interface Agent {
  id: string;
  intent: AgentIntent;
  currentNodeId: string;
  destinationNodeId: string;
  position: { x: number; y: number };
  speed: number;
  currentRoute: string[];
  currentEdgeId?: string;
  state: "WALKING" | "WAITING" | "QUEUING" | "REROUTING" | "EXITED";
  edgeProgress?: number;
  replanTimer: number;
  dwellTime: number;
  destinationType?: string;
  destinationReason?: string;
}

export class SimulationEngine {
  private io: SocketIOServer;
  private hf: HfInference;
  private isRunning: boolean = false;
  private tickRateMs = 100;
  private intervalId: NodeJS.Timeout | null = null;

  public simulationSpeed: number = 1;
  public venueId: string = "";
  public nodes: Node[] = [];
  public edges: Edge[] = [];
  public agents: Agent[] = [];

  public nodeMap: Map<string, Node> = new Map();
  private edgeMap: Map<string, Edge> = new Map();
  private adjList: Map<string, string[]> = new Map();

  public nodeOccupancy: Map<string, number> = new Map();
  public edgeOccupancy: Map<string, number> = new Map();
  
  public currentRiskScore: number = 0;
  public peakRiskScore: number = 0;
  public peakDensity: number = 0;
  public averageDensity: number = 0;
  public bottlenecks: string[] = [];
  public currentRiskBreakdown: RiskBreakdown | null = null;
  public riskTimeline: { timestamp: number; riskScore: number; crowdDensity: number; queueRatio: number; exitUtilization: number; blockedPathRatio: number; }[] = [];
  private simulationStartTime: number = 0;

  public agentsSpawnedSoFar = 0;
  public totalAgentsToSpawn = 0;
  public exitedAgentsCount = 0;
  public totalReroutedAgentsCount = 0;
  public lastAiRecommendation: any = null;
  public aiRecommendationHistory: any[] = [];
  
  public calibrationMultiplier = 1.0;
  public datasetMetrics: any = null;
  public hfDatasetInfo: string = "";
  public datasetSamples: any[] = [];
  public eventSchedule: string = "Normal";

  constructor(io: SocketIOServer, hf: HfInference) {
    this.io = io;
    this.hf = hf;
  }

  public loadVenue(venue: any, crowdSize: number = 200, eventSchedule: string = "Normal") {
    this.eventSchedule = eventSchedule;
    this.nodes = venue.nodes || [];
    this.edges = venue.edges || [];
    this.venueId = venue.id;
    this.nodeMap.clear();
    this.edgeMap.clear();
    this.adjList.clear();
    this.nodeOccupancy.clear();
    this.edgeOccupancy.clear();
    this.agents = [];
    this.agentsSpawnedSoFar = 0;
    this.totalAgentsToSpawn = crowdSize;
    this.exitedAgentsCount = 0;
    this.totalReroutedAgentsCount = 0;
    this.lastAiRecommendation = null;
    this.aiRecommendationHistory = [];
    this.currentRiskScore = 0;
    this.peakRiskScore = 0;
    this.peakDensity = 0;
    this.averageDensity = 0;
    this.bottlenecks = [];
    this.currentRiskBreakdown = null;
    this.riskTimeline = [];
    this.simulationStartTime = Date.now();

    this.nodes.forEach(n => {
      this.nodeMap.set(n.id, n);
      this.adjList.set(n.id, []);
    });

    this.edges.forEach(e => {
      const sourceNode = this.nodeMap.get(e.source);
      const targetNode = this.nodeMap.get(e.target);
      
      if (!sourceNode || !targetNode) return;
      
      this.edgeMap.set(e.id, e);
      if (sourceNode.data?.type !== 'restricted' && targetNode.data?.type !== 'restricted') {
         this.adjList.get(e.source)?.push(e.target);
      }
      
      if (e.data?.direction === "bidirectional") {
        if (targetNode.data?.type !== 'restricted' && sourceNode.data?.type !== 'restricted') {
          this.adjList.get(e.target)?.push(e.source);
        }
      }
    });
  }

  public setCalibrationMultiplier(m: number) {
     this.calibrationMultiplier = m;
  }

  public getNodeCategory(node: Node): 'entry' | 'exit' | 'emergency' | 'food_court' | 'waiting_area' | 'concourse' {
    if (node.data?.type === 'restricted') return 'concourse';
    const type = (node.data?.type || node.type || '').toLowerCase();
    const label = (node.data?.label || '').toLowerCase();
    
    if (type === 'emergency' || label.includes('emergency')) {
      return 'emergency';
    }
    if (type === 'entry' || type === 'input' || label.includes('entry') || (label.includes('gate') && !label.includes('exit'))) {
      return 'entry';
    }
    if (type === 'food_court' || type === 'food_shop' || label.includes('food') || label.includes('concession')) {
      return 'food_court';
    }
    if (type === 'waiting_area' || type === 'lounge' || label.includes('waiting') || label.includes('lounge') || label.includes('seating')) {
      return 'waiting_area';
    }
    if (type === 'exit' || type === 'output' || label.includes('exit')) {
      return 'exit';
    }
    return 'concourse';
  }

  public selectIntentForAgent(currentIntent?: AgentIntent, isInitialSpawn: boolean = false): AgentIntent {
    if (this.eventSchedule === "Emergency Evacuation") {
      return "EVACUATING";
    }

    const rand = Math.random();

    if (this.eventSchedule === "Stadium Entry") {
      if (isInitialSpawn) {
        if (rand < 0.75) return "WALKING_TO_AREA";
        if (rand < 0.90) return "FOOD";
        return "WAITING";
      } else {
        if (rand < 0.60) return "WALKING_TO_AREA";
        if (rand < 0.85) return "WAITING";
        return "EXITING";
      }
    }

    if (this.eventSchedule === "Half-time") {
      if (currentIntent === "FOOD") {
        if (rand < 0.60) return "WAITING";
        if (rand < 0.90) return "WALKING_TO_AREA";
        return "EXITING";
      }
      if (rand < 0.55) return "FOOD";
      if (rand < 0.80) return "WALKING_TO_AREA";
      if (rand < 0.95) return "WAITING";
      return "EXITING";
    }

    if (this.eventSchedule === "Food Court Rush") {
      if (currentIntent === "FOOD") {
        if (rand < 0.60) return "WAITING";
        if (rand < 0.90) return "WALKING_TO_AREA";
        return "EXITING";
      }
      if (rand < 0.70) return "FOOD";
      if (rand < 0.90) return "WALKING_TO_AREA";
      return "EXITING";
    }

    if (this.eventSchedule === "Event Ending") {
      if (isInitialSpawn) {
        if (rand < 0.85) return "EXITING";
        if (rand < 0.95) return "WALKING_TO_AREA";
        return "FOOD";
      }
      return "EXITING";
    }

    // Normal schedule: 60% concourse/general, 20% food, 10% waiting, 10% exiting
    if (isInitialSpawn) {
      if (rand < 0.60) return "WALKING_TO_AREA";
      if (rand < 0.80) return "FOOD";
      if (rand < 0.90) return "WAITING";
      return "EXITING";
    } else {
      if (rand < 0.40) return "WALKING_TO_AREA";
      if (rand < 0.70) return "WAITING";
      return "EXITING";
    }
  }

  public selectBestDestinationForIntent(currentNodeId: string, intent: AgentIntent, currentAgent?: Agent): {
    bestNode: Node | null;
    bestPath: string[];
    bestCost: number;
    destinationType: string;
    reason: string;
  } {
    let candidateNodes: Node[] = [];
    const nonRestrictedNodes = this.nodes.filter(n => n.data?.type !== 'restricted');

    if (intent === "EVACUATING") {
      candidateNodes = nonRestrictedNodes.filter(n => {
        const cat = this.getNodeCategory(n);
        return cat === 'exit' || cat === 'emergency';
      });
    } else if (intent === "EXITING") {
      const normalExits = nonRestrictedNodes.filter(n => this.getNodeCategory(n) === 'exit');
      let validNormalExit = false;
      for (const ne of normalExits) {
        const { path } = this.findShortestPathWithCost(currentNodeId, ne.id);
        if (path.length > 0) {
          validNormalExit = true;
          break;
        }
      }

      if (validNormalExit) {
        candidateNodes = normalExits;
      } else {
        candidateNodes = nonRestrictedNodes.filter(n => {
          const cat = this.getNodeCategory(n);
          return cat === 'exit' || cat === 'emergency';
        });
      }
    } else if (intent === "FOOD") {
      candidateNodes = nonRestrictedNodes.filter(n => this.getNodeCategory(n) === 'food_court');
      if (candidateNodes.length === 0) {
        candidateNodes = nonRestrictedNodes.filter(n => this.getNodeCategory(n) === 'concourse' || this.getNodeCategory(n) === 'waiting_area');
      }
    } else if (intent === "WAITING") {
      candidateNodes = nonRestrictedNodes.filter(n => this.getNodeCategory(n) === 'waiting_area' || this.getNodeCategory(n) === 'concourse');
      if (candidateNodes.length === 0) {
        candidateNodes = nonRestrictedNodes.filter(n => {
          const cat = this.getNodeCategory(n);
          return cat !== 'entry' && cat !== 'exit' && cat !== 'emergency';
        });
      }
    } else if (intent === "WALKING_TO_AREA" || intent === "ENTERING") {
      candidateNodes = nonRestrictedNodes.filter(n => this.getNodeCategory(n) === 'concourse');
      if (candidateNodes.length === 0) {
        candidateNodes = nonRestrictedNodes.filter(n => {
          const cat = this.getNodeCategory(n);
          return cat !== 'entry' && cat !== 'exit' && cat !== 'emergency';
        });
      }
    }

    if (candidateNodes.length === 0) {
      candidateNodes = nonRestrictedNodes.filter(n => n.id !== currentNodeId);
    }
    if (candidateNodes.length === 0) {
      candidateNodes = nonRestrictedNodes;
    }

    let bestNode: Node | null = null;
    let bestCost = Infinity;
    let bestPath: string[] = [];
    let bestReason = "Lowest safe route cost";

    for (const candidate of candidateNodes) {
      if (candidate.id === currentNodeId && candidateNodes.length > 1) continue;

      const cat = this.getNodeCategory(candidate);
      const { path, cost } = this.findShortestPathWithCost(currentNodeId, candidate.id);
      if (path.length === 0 || cost === Infinity) continue;

      let score = cost;
      const destOcc = this.nodeOccupancy.get(candidate.id) || 0;
      const destCap = candidate.data?.capacity || 200;
      const destUtil = destOcc / destCap;

      const agentSeed = currentAgent ? (parseInt(currentAgent.id.replace(/\D/g, '') || '0') % 10) * 0.5 : Math.random() * 2;
      score += destUtil * 50 + agentSeed;

      let candidateReason = "Lowest safe route cost";

      if (intent === "EVACUATING") {
        if (cat === 'emergency') {
          score -= 40;
          candidateReason = "Emergency Exit prioritized during Evacuation";
        } else {
          candidateReason = "Normal Exit Gate used for Evacuation";
        }
      } else if (intent === "EXITING") {
        if (cat === 'emergency') {
          score += 10000;
          candidateReason = "Emergency Exit fallback (Normal Exits blocked/full)";
        } else {
          candidateReason = "Normal Exit Gate preferred";
        }
      } else if (intent === "FOOD") {
        candidateReason = "Food Court / Concession Area";
      } else if (intent === "WAITING") {
        candidateReason = "Waiting Lounge / Meeting Point";
      } else if (intent === "WALKING_TO_AREA" || intent === "ENTERING") {
        candidateReason = "Main Concourse / Venue interior";
      }

      if (score < bestCost) {
        bestCost = score;
        bestNode = candidate;
        bestPath = path;
        bestReason = candidateReason;
      }
    }

    let destType = "CONCOURSE";
    if (bestNode) {
      const cat = this.getNodeCategory(bestNode);
      if (cat === 'exit') destType = "NORMAL_EXIT";
      else if (cat === 'emergency') destType = "EMERGENCY_EXIT";
      else if (cat === 'food_court') destType = "FOOD_COURT";
      else if (cat === 'waiting_area') destType = "WAITING_AREA";
      else destType = "CONCOURSE";
    }

    return {
      bestNode,
      bestPath,
      bestCost,
      destinationType: destType,
      reason: bestReason
    };
  }

  // Wrapper method for backward compatibility
  public selectBestDestination(currentNodeId: string, currentAgent?: Agent): {
    bestExit: Node | null;
    bestPath: string[];
    bestCost: number;
    destinationType: string;
    reason: string;
  } {
    const intent = currentAgent?.intent || (this.eventSchedule === "Emergency Evacuation" ? "EVACUATING" : "EXITING");
    const res = this.selectBestDestinationForIntent(currentNodeId, intent, currentAgent);
    return {
      bestExit: res.bestNode,
      bestPath: res.bestPath,
      bestCost: res.bestCost,
      destinationType: res.destinationType,
      reason: res.reason
    };
  }

  public applyAiRecommendation(rec: any) {
    if (!rec) return;

    // Standardize recommendation object structure
    const structuredRec = {
      timestamp: new Date().toLocaleTimeString(),
      riskLevel: rec.riskLevel || "LOW",
      recommendedAction: rec.recommendedAction || "Continue monitoring.",
      recommendedExit: rec.recommendedExit || "",
      reroutePercentage: typeof rec.reroutePercentage === "number" ? rec.reroutePercentage : (parseInt(rec.reroutePercentage) || 0),
      affectedNodes: Array.isArray(rec.affectedNodes) ? rec.affectedNodes : [],
      reason: rec.reason || "AI safety assessment",
      expectedRiskReduction: rec.expectedRiskReduction || 0,
      source: rec.source || "huggingface"
    };

    this.lastAiRecommendation = structuredRec;
    this.aiRecommendationHistory.unshift(structuredRec);
    if (this.aiRecommendationHistory.length > 5) {
      this.aiRecommendationHistory.pop();
    }

    const { recommendedExit, reroutePercentage, affectedNodes } = structuredRec;

    if (!recommendedExit || reroutePercentage <= 0) {
      console.log(`[AI Recommendation] No reroute action needed (${structuredRec.recommendedAction}).`);
      return;
    }

    // Find the target exit node
    const targetExitNode = this.nodes.find(n => {
      const label = (n.data?.label || "").toLowerCase();
      const recExit = recommendedExit.toLowerCase();
      const cat = this.getNodeCategory(n);
      return (
        label === recExit ||
        n.id === recommendedExit ||
        (cat === 'exit' && (label.includes(recExit) || recExit.includes(label))) ||
        (cat === 'emergency' && (label.includes(recExit) || recExit.includes('emergency')))
      );
    }) || this.nodes.find(n => this.getNodeCategory(n) === 'exit') 
       || this.nodes.find(n => this.getNodeCategory(n) === 'emergency');

    if (!targetExitNode) {
      console.log(`[AI Recommendation] Target exit "${recommendedExit}" not found in venue graph.`);
      return;
    }

    // Find eligible active agents
    const activeAgents = this.agents.filter(a => a.state !== "EXITED");
    if (activeAgents.length === 0) return;

    const matchesAffectedNode = (nodeId: string) => {
      const node = this.nodeMap.get(nodeId);
      const label = node?.data?.label || nodeId;
      return affectedNodes.some((aff: string) => 
        aff.toLowerCase() === nodeId.toLowerCase() || 
        aff.toLowerCase() === label.toLowerCase() ||
        label.toLowerCase().includes(aff.toLowerCase())
      );
    };

    let eligibleAgents = activeAgents.filter(a => {
      if (a.destinationNodeId === targetExitNode.id) return false;
      const passesAffected = a.currentRoute.some(nId => matchesAffectedNode(nId));
      const atAffected = matchesAffectedNode(a.currentNodeId);
      return passesAffected || atAffected || affectedNodes.length === 0;
    });

    if (eligibleAgents.length === 0) {
      eligibleAgents = activeAgents.filter(a => a.destinationNodeId !== targetExitNode.id);
    }

    if (eligibleAgents.length === 0) return;

    const pct = Math.min(100, Math.max(0, reroutePercentage));
    const targetCount = Math.max(1, Math.round(eligibleAgents.length * (pct / 100)));

    let actualReroutedThisCall = 0;

    for (let i = 0; i < Math.min(targetCount, eligibleAgents.length); i++) {
      const agent = eligibleAgents[i];

      const { path } = this.findShortestPathWithCost(agent.currentNodeId, targetExitNode.id);

      if (path && path.length > 0) {
        agent.state = "REROUTING";
        agent.destinationNodeId = targetExitNode.id;
        agent.currentRoute = path;
        agent.destinationType = this.getNodeCategory(targetExitNode) === 'emergency' ? "EMERGENCY_EXIT" : "NORMAL_EXIT";
        agent.destinationReason = `[AI Reroute] ${structuredRec.recommendedAction}`;
        agent.currentEdgeId = undefined;
        agent.edgeProgress = 0;

        actualReroutedThisCall++;
        this.totalReroutedAgentsCount++;
      }
    }

    console.log(`[AI Rerouting Applied] Rerouted ${actualReroutedThisCall} agents to ${targetExitNode.data?.label || targetExitNode.id}. Cumulative Rerouted: ${this.totalReroutedAgentsCount}.`);
  }

  private spawnAgentsTick() {
    if (this.agentsSpawnedSoFar >= this.totalAgentsToSpawn) return;

    const entries = this.nodes.filter(n => this.getNodeCategory(n) === "entry" && n.data?.type !== "restricted");
    if (entries.length === 0) return;

    let baseSpawn = 2 + Math.random() * 4;
    if (this.eventSchedule === "Stadium Entry") baseSpawn = 12 + Math.random() * 8;
    else if (this.eventSchedule === "Event Ending") baseSpawn = 18 + Math.random() * 10;
    else if (this.eventSchedule === "Emergency Evacuation") baseSpawn = 25 + Math.random() * 15;
    else if (this.eventSchedule === "Half-time") baseSpawn = 5 + Math.random() * 5;
    
    let toSpawn = Math.min(
      Math.floor(baseSpawn * this.simulationSpeed),
      this.totalAgentsToSpawn - this.agentsSpawnedSoFar
    );

    for (let i = 0; i < toSpawn; i++) {
      const entry = entries[Math.floor(Math.random() * entries.length)];
      
      const intent = this.selectIntentForAgent(undefined, true);
      const { bestNode, bestPath, destinationType, reason } = this.selectBestDestinationForIntent(entry.id, intent);

      if (bestNode && bestPath.length > 0) {
        this.agentsSpawnedSoFar++;
        let speedMultiplier = 1.0;
        if (this.eventSchedule === "Emergency Evacuation") speedMultiplier = 1.3 + Math.random() * 0.4;
        else speedMultiplier = 1.0 + Math.random() * 0.5;

        let initialDwell = 0;
        if (intent === "FOOD") initialDwell = Math.floor(30 + Math.random() * 30);
        else if (intent === "WAITING") initialDwell = Math.floor(20 + Math.random() * 30);

        const spawnIdNum = this.agentsSpawnedSoFar;
        const spawnAngle = (spawnIdNum * 137.5 * Math.PI) / 180;
        const spawnRadius = 4 + (Math.floor(spawnIdNum / 6) % 6) * 5;
        const spawnOffsetX = Math.cos(spawnAngle) * spawnRadius;
        const spawnOffsetY = Math.sin(spawnAngle) * spawnRadius;

        this.agents.push({
          id: `agent_${this.agentsSpawnedSoFar}`,
          intent,
          currentNodeId: entry.id,
          destinationNodeId: bestNode.id,
          position: { x: entry.position.x + 65 + spawnOffsetX, y: entry.position.y + 18 + spawnOffsetY },
          speed: speedMultiplier,
          currentRoute: bestPath,
          state: "WALKING",
          replanTimer: 15 + Math.random() * 20,
          dwellTime: initialDwell,
          edgeProgress: 0,
          destinationType,
          destinationReason: reason
        });
      }
    }
  }

  private findShortestPathWithCost(start: string, goal: string): { path: string[], cost: number } {
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const queue = new Set<string>();

    this.nodes.forEach(n => {
      dist.set(n.id, Infinity);
      prev.set(n.id, null);
      queue.add(n.id);
    });
    dist.set(start, 0);

    while (queue.size > 0) {
      let u: string | null = null;
      let min = Infinity;
      queue.forEach(node => {
        if (dist.get(node)! < min) {
          min = dist.get(node)!;
          u = node;
        }
      });

      if (!u || min === Infinity) break;
      if (u === goal) break;
      queue.delete(u);

      const neighbors = this.adjList.get(u) || [];
      for (const v of neighbors) {
        if (!queue.has(v)) continue;
        
        const edge = this.edges.find(e => 
           (e.source === u && e.target === v) || 
           (e.data?.direction === "bidirectional" && e.source === v && e.target === u)
        );
        
        const edgeDist = edge?.data?.distance || 50;
        const edgeCapacity = edge?.data?.capacity || 200;
        const edgeTravelTime = edge?.data?.travelTime || 30;
        
        const targetNode = this.nodeMap.get(v);
        const nodeCapacity = targetNode?.data?.capacity || 200;
        const occupancy = this.nodeOccupancy.get(v) || 0;
        const congestionRatio = Math.min(1, occupancy / nodeCapacity);
        
        const currentEdgeOccupancy = edge ? (this.edgeOccupancy.get(edge.id) || 0) : 0;
        const edgeCongestionRatio = Math.min(1, currentEdgeOccupancy / edgeCapacity);

        const weight = (edgeDist + edgeTravelTime) * (1 + (congestionRatio * 3) + (edgeCongestionRatio * 2));
        const alt = dist.get(u)! + weight;
        
        if (alt < dist.get(v)!) {
          dist.set(v, alt);
          prev.set(v, u);
        }
      }
    }

    const path: string[] = [];
    let curr: string | null = goal;
    if (prev.get(curr) !== null || curr === start) {
      while (curr !== null) {
        path.unshift(curr);
        curr = prev.get(curr)!;
      }
    }
    return { path, cost: dist.get(goal)! };
  }

  public setSpeed(speed: number) {
    this.simulationSpeed = speed;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), this.tickRateMs);
  }

  public pause() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public stop() {
    this.pause();
  }

  public getScheduleEffects() {
    switch (this.eventSchedule) {
      case "Stadium Entry":
        return {
          spawnRate: 15,
          movementSpeedMultiplier: 1.1,
          exitPriority: "VENUE_AREAS",
          foodAreaDemand: "LOW",
          emergencyMode: false,
          description: "High ingress flow at Entry Gates into main concourse and venue areas."
        };
      case "Half-time":
        return {
          spawnRate: 5,
          movementSpeedMultiplier: 0.9,
          exitPriority: "FOOD_AND_LOUNGE",
          foodAreaDemand: "HIGH",
          emergencyMode: false,
          description: "Movement directed towards Food Courts, concessions, and waiting lounges."
        };
      case "Food Court Rush":
        return {
          spawnRate: 6,
          movementSpeedMultiplier: 0.85,
          exitPriority: "FOOD_COURT_PRIMARY",
          foodAreaDemand: "MAXIMUM",
          emergencyMode: false,
          description: "Peak food court demand with queueing and delayed exit movement."
        };
      case "Event Ending":
        return {
          spawnRate: 20,
          movementSpeedMultiplier: 1.2,
          exitPriority: "NORMAL_GATES_EGRESS",
          foodAreaDemand: "LOW",
          emergencyMode: false,
          description: "Mass egress transition toward main Exit Gates."
        };
      case "Emergency Evacuation":
        return {
          spawnRate: 30,
          movementSpeedMultiplier: 1.5,
          exitPriority: "EMERGENCY_MAXIMUM",
          foodAreaDemand: "NONE",
          emergencyMode: true,
          description: "Emergency protocol active: All agents immediately EVACUATE via safest exits."
        };
      case "Normal":
      default:
        return {
          spawnRate: 4,
          movementSpeedMultiplier: 1.0,
          exitPriority: "BALANCED_VENUE_MIX",
          foodAreaDemand: "MODERATE",
          emergencyMode: false,
          description: "Realistic crowd mix: Concourse walking, food area, waiting lounge & steady exit."
        };
    }
  }

  private calculateRisk(activeAgents: number): RiskBreakdown {
    let maxNodeDensity = 0;

    this.nodes.forEach(n => {
       const capacity = n.data?.capacity || 200;
       const occupancy = this.nodeOccupancy.get(n.id) || 0;
       const density = Math.min(1, occupancy / capacity);
       if (density > maxNodeDensity) maxNodeDensity = density;
    });

    const totalQueuedAgents = this.agents.filter(a => a.state === "QUEUING").length;
    const queueRatio = activeAgents === 0 ? 0 : Math.min(1, totalQueuedAgents / activeAgents);

    let maxExitUtilization = 0;
    this.nodes.forEach(n => {
       const cat = this.getNodeCategory(n);
       if (cat === 'exit' || cat === 'emergency') {
          const capacity = n.data?.capacity || 200;
          const occupancy = this.nodeOccupancy.get(n.id) || 0;
          const util = Math.min(1, occupancy / capacity);
          if (util > maxExitUtilization) maxExitUtilization = util;
       }
    });

    let totalUsableEdges = 0;
    let blockedEdges = 0;
    this.edges.forEach(e => {
       totalUsableEdges++;
       const capacity = e.data?.capacity || 200;
       const occupancy = this.edgeOccupancy.get(e.id) || 0;
       if (occupancy / capacity >= 0.8) {
          blockedEdges++;
       }
    });
    const blockedPathRatio = totalUsableEdges === 0 ? 0 : Math.min(1, blockedEdges / totalUsableEdges);

    const crowdDensity = activeAgents === 0 ? 0 : maxNodeDensity;
    const finalQueueRatio = activeAgents === 0 ? 0 : queueRatio;
    const finalExitUtil = activeAgents === 0 ? 0 : maxExitUtilization;
    const finalBlockedRatio = activeAgents === 0 ? 0 : blockedPathRatio;

    const crowdContribution = parseFloat((0.40 * crowdDensity * 100).toFixed(1));
    const queueContribution = parseFloat((0.25 * finalQueueRatio * 100).toFixed(1));
    const exitContribution = parseFloat((0.20 * finalExitUtil * 100).toFixed(1));
    const blockedContribution = parseFloat((0.15 * finalBlockedRatio * 100).toFixed(1));

    const riskScore = parseFloat((crowdContribution + queueContribution + exitContribution + blockedContribution).toFixed(1));
    
    let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
    if (riskScore >= 75) riskLevel = "CRITICAL";
    else if (riskScore >= 50) riskLevel = "HIGH";
    else if (riskScore >= 25) riskLevel = "MODERATE";

    return {
       crowdDensity,
       queueRatio: finalQueueRatio,
       exitUtilization: finalExitUtil,
       blockedPathRatio: finalBlockedRatio,
       riskScore,
       riskLevel,
       contributions: {
          crowd: crowdContribution,
          queue: queueContribution,
          exit: exitContribution,
          blocked: blockedContribution
       }
    };
  }

  private tick() {
    this.spawnAgentsTick();

    // Forced Emergency Override
    if (this.eventSchedule === "Emergency Evacuation") {
      for (const agent of this.agents) {
        if (agent.state !== "EXITED" && agent.intent !== "EVACUATING") {
          agent.intent = "EVACUATING";
          const { bestNode, bestPath, destinationType, reason } = this.selectBestDestinationForIntent(agent.currentNodeId, "EVACUATING", agent);
          if (bestNode && bestPath.length > 0) {
            agent.destinationNodeId = bestNode.id;
            agent.currentRoute = bestPath;
            agent.destinationType = destinationType;
            agent.destinationReason = reason;
            agent.state = "WALKING";
            agent.edgeProgress = 0;
            agent.currentEdgeId = undefined;
          }
        }
      }
    }
    
    let activeWalking = 0;
    let activeQueued = 0;
    let activeRerouted = 0;
    this.nodeOccupancy.clear();
    this.edgeOccupancy.clear();
    
    // Calculate Occupancy
    for (const agent of this.agents) {
      if (agent.state === "EXITED") continue;
      this.nodeOccupancy.set(agent.currentNodeId, (this.nodeOccupancy.get(agent.currentNodeId) || 0) + 1);
      if (agent.currentEdgeId) {
         this.edgeOccupancy.set(agent.currentEdgeId, (this.edgeOccupancy.get(agent.currentEdgeId) || 0) + 1);
      }
    }

    // Move agents
    let totalSpeed = 0;
    let agentsWithSpeed = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      if (agent.state === "EXITED") continue;

      const currentNode = this.nodeMap.get(agent.currentNodeId);

      // Are we currently at our destination node?
      if (agent.currentNodeId === agent.destinationNodeId) {
        const cat = currentNode ? this.getNodeCategory(currentNode) : 'unknown';

        if ((agent.intent === "EXITING" || agent.intent === "EVACUATING") && (cat === "exit" || cat === "emergency")) {
          agent.state = "EXITED";
          this.exitedAgentsCount++;
          continue;
        }

        // Interior area dwelling
        agent.state = "WAITING";
        if (agent.dwellTime > 0) {
          agent.dwellTime -= 1 * this.simulationSpeed;
          continue;
        }

        // Dwell time expired -> transition intent
        const newIntent = this.selectIntentForAgent(agent.intent, false);
        const { bestNode, bestPath, destinationType, reason } = this.selectBestDestinationForIntent(agent.currentNodeId, newIntent, agent);

        if (bestNode && bestPath.length > 0) {
          agent.intent = newIntent;
          agent.destinationNodeId = bestNode.id;
          agent.currentRoute = bestPath;
          agent.destinationType = destinationType;
          agent.destinationReason = reason;
          agent.state = "WALKING";
          agent.edgeProgress = 0;
          agent.currentEdgeId = undefined;

          if (newIntent === "FOOD") agent.dwellTime = Math.floor(30 + Math.random() * 30);
          else if (newIntent === "WAITING") agent.dwellTime = Math.floor(20 + Math.random() * 30);
          else agent.dwellTime = 0;
        } else {
          // Fallback exit transition
          agent.intent = "EXITING";
          const fallback = this.selectBestDestinationForIntent(agent.currentNodeId, "EXITING", agent);
          if (fallback.bestNode) {
            agent.destinationNodeId = fallback.bestNode.id;
            agent.currentRoute = fallback.bestPath;
            agent.destinationType = fallback.destinationType;
            agent.destinationReason = fallback.reason;
            agent.state = "WALKING";
          }
        }
        continue;
      }

      const currentRouteIdx = agent.currentRoute.indexOf(agent.currentNodeId);
      if (currentRouteIdx === -1 || currentRouteIdx === agent.currentRoute.length - 1) {
         agent.currentNodeId = agent.destinationNodeId;
         continue;
      }

      const nextNodeId = agent.currentRoute[currentRouteIdx + 1];
      const nextNode = this.nodeMap.get(nextNodeId);
      
      if (!currentNode || !nextNode) continue;

      let edge = this.edges.find(e => 
           (e.source === agent.currentNodeId && e.target === nextNodeId) || 
           (e.data?.direction === "bidirectional" && e.source === nextNodeId && e.target === agent.currentNodeId)
      );

      if (!edge) {
         agent.state = "REROUTING";
         const { bestNode, bestPath, destinationType, reason } = this.selectBestDestinationForIntent(agent.currentNodeId, agent.intent, agent);
         if (bestNode && bestPath.length > 0) {
             agent.currentRoute = bestPath;
             agent.destinationNodeId = bestNode.id;
             agent.destinationType = destinationType;
             agent.destinationReason = reason;
             agent.state = "WALKING";
         }
         continue;
      }

      agent.currentEdgeId = edge.id;

      // Dynamic Congestion Replanning
      agent.replanTimer -= 1 * this.simulationSpeed;
      if (agent.replanTimer <= 0) {
         agent.replanTimer = 15 + Math.random() * 20;
         const targetOccupancy = this.nodeOccupancy.get(nextNodeId) || 0;
         const targetCapacity = nextNode.data?.capacity || 200;
         if (targetOccupancy > (targetCapacity * 0.8 * this.calibrationMultiplier)) {
             agent.state = "REROUTING";
             const { bestNode, bestPath, destinationType, reason } = this.selectBestDestinationForIntent(agent.currentNodeId, agent.intent, agent);
             if (bestNode && bestPath.length > 0 && bestPath[1] !== nextNodeId) {
                 agent.currentRoute = bestPath;
                 agent.destinationNodeId = bestNode.id;
                 agent.destinationType = destinationType;
                 agent.destinationReason = reason;
                 agent.currentEdgeId = undefined;
                 agent.edgeProgress = 0;
                 agent.state = "WALKING";
                 continue;
             }
             agent.state = "WALKING";
         }
      }

      const targetOccupancy = this.nodeOccupancy.get(nextNodeId) || 0;
      const targetCapacity = nextNode.data?.capacity || 200;
      const edgeOccupancy = this.edgeOccupancy.get(edge.id) || 0;
      const edgeCapacity = edge.data?.capacity || 200;

      const nodeCongestion = targetOccupancy / targetCapacity;
      const edgeCongestion = edgeOccupancy / edgeCapacity;
      
      let speedMultiplier = 1.0;
      if (nodeCongestion > 0.4 || edgeCongestion > 0.4) speedMultiplier = 0.8;
      if (nodeCongestion > 0.7 || edgeCongestion > 0.7) speedMultiplier = 0.5;
      if (nodeCongestion > 0.9 || edgeCongestion > 0.9) speedMultiplier = 0.2;
      
      if (nodeCongestion > 1.0) {
         agent.state = "QUEUING";
         speedMultiplier = 0.05;
      } else if (agent.state !== "WAITING") {
         agent.state = "WALKING";
      }

      if (agent.state === "WALKING") activeWalking++;
      if (agent.state === "QUEUING") activeQueued++;
      if ((agent.state as string) === "REROUTING") activeRerouted++;
      
      const effectiveSpeed = agent.speed * speedMultiplier;
      totalSpeed += effectiveSpeed;
      agentsWithSpeed++;

      const edgeLen = edge.data?.distance || 50;
      // Calibrated step progress for realistic demo speed:
      // Short edge (30-40m): ~1.8s - 2.2s (18-22 ticks at 1x)
      // Medium edge (50-70m): ~2.5s - 3.5s (25-35 ticks at 1x)
      // Long edge (80-100m): ~3.5s - 5.0s (35-50 ticks at 1x)
      const baseTicks = Math.max(16, Math.min(50, Math.round((edgeLen / 50) * 28)));
      const baseProgress = 1 / baseTicks;
      const stepProgress = Math.max(0.005, baseProgress * agent.speed * speedMultiplier * this.simulationSpeed);

      agent.edgeProgress = (agent.edgeProgress || 0) + stepProgress;

      const idNum = parseInt(agent.id.replace(/\D/g, '') || '0', 10);

      if (agent.edgeProgress >= 1.0) {
         agent.currentNodeId = nextNodeId;
         agent.edgeProgress = 0;
         agent.currentEdgeId = undefined;

         // Deterministic crowd dispersion around target node center (65, 18)
         const angle = (idNum * 137.5 * Math.PI) / 180;
         const ringIndex = Math.floor(idNum / 6);
         const radius = 4 + (ringIndex % 6) * 5;
         const offsetX = Math.cos(angle) * radius;
         const offsetY = Math.sin(angle) * radius;

         agent.position = { 
           x: nextNode.position.x + 65 + offsetX, 
           y: nextNode.position.y + 18 + offsetY 
         };
      } else {
         const fromX = currentNode.position.x + 65;
         const fromY = currentNode.position.y + 18;
         const toX = nextNode.position.x + 65;
         const toY = nextNode.position.y + 18;

         const dx = toX - fromX;
         const dy = toY - fromY;
         const dist = Math.hypot(dx, dy) || 1;
         const px = -dy / dist;
         const py = dx / dist;

         // Corridor lane dispersion (-10px to +10px)
         const laneOffset = (((idNum * 7) % 7) - 3) * 3.5;

         const lineX = fromX + dx * agent.edgeProgress;
         const lineY = fromY + dy * agent.edgeProgress;

         agent.position.x = lineX + px * laneOffset;
         agent.position.y = lineY + py * laneOffset;
      }
    }

    this.bottlenecks = [];
    let maxRisk = 0;
    let totalDensity = 0;
    let nodesWithPeople = 0;
    
    this.nodeOccupancy.forEach((count, nodeId) => {
      if (count > 0) {
        totalDensity += count;
        nodesWithPeople++;
        this.peakDensity = Math.max(this.peakDensity, count);
      }
      const node = this.nodeMap.get(nodeId);
      const capacity = node?.data?.capacity || 200;
      const ratio = count / capacity;
      
      if (ratio >= (0.8 * this.calibrationMultiplier) && node) {
        this.bottlenecks.push(`Congestion at ${node.data?.label || nodeId} (${Math.round(ratio * 100)}% cap)`);
        maxRisk = Math.max(maxRisk, Math.min(100, ratio * 100));
      }
    });

    if (nodesWithPeople > 0) {
      const currentAvg = totalDensity / nodesWithPeople;
      this.averageDensity = this.averageDensity === 0 ? currentAvg : (this.averageDensity + currentAvg) / 2;
    }

    const activeAgents = this.agents.filter(a => a.state !== "EXITED").length;
    this.currentRiskBreakdown = this.calculateRisk(activeAgents);
    this.currentRiskScore = this.currentRiskBreakdown.riskScore;
    if (this.currentRiskScore > this.peakRiskScore) this.peakRiskScore = this.currentRiskScore;

    if (activeAgents > 0) {
       this.riskTimeline.push({
          timestamp: Date.now() - this.simulationStartTime,
          riskScore: this.currentRiskScore,
          crowdDensity: this.currentRiskBreakdown.crowdDensity,
          queueRatio: this.currentRiskBreakdown.queueRatio,
          exitUtilization: this.currentRiskBreakdown.exitUtilization,
          blockedPathRatio: this.currentRiskBreakdown.blockedPathRatio
       });
       if (this.riskTimeline.length > 50) this.riskTimeline.shift();
    }

    if (activeAgents === 0 && this.agentsSpawnedSoFar === this.totalAgentsToSpawn) {
      this.pause(); 
    }

    const nodeDensityObj: Record<string, number> = {};
    this.nodeOccupancy.forEach((val, key) => { nodeDensityObj[key] = val; });
    const edgeDensityObj: Record<string, number> = {};
    this.edgeOccupancy.forEach((val, key) => { edgeDensityObj[key] = val; });

    const sampleAgent = this.agents.find(a => a.state !== "EXITED");
    let debugInfo = null;
    if (sampleAgent) {
       const destNode = this.nodeMap.get(sampleAgent.destinationNodeId);
       debugInfo = {
          id: sampleAgent.id,
          intent: sampleAgent.intent,
          state: sampleAgent.state,
          currentNode: this.nodeMap.get(sampleAgent.currentNodeId)?.data?.label || sampleAgent.currentNodeId,
          destination: destNode?.data?.label || sampleAgent.destinationNodeId,
          destinationType: sampleAgent.destinationType || "CONCOURSE",
          destinationReason: sampleAgent.destinationReason || "Venue interior navigation",
          currentRoute: sampleAgent.currentRoute.map(nId => this.nodeMap.get(nId)?.data?.label || nId),
          currentEdge: sampleAgent.currentEdgeId,
          speed: sampleAgent.speed.toFixed(2),
          dwellTime: sampleAgent.dwellTime
       };
    }

    this.io.emit("simulation_tick", {
      agents: this.agents.map(a => ({ 
         id: a.id, 
         x: a.position.x, 
         y: a.position.y, 
         intent: a.intent,
         state: a.state 
      })),
      eventSchedule: this.eventSchedule,
      scheduleEffects: this.getScheduleEffects(),
      bottlenecks: this.bottlenecks,
      riskScore: this.currentRiskScore,
      riskBreakdown: this.currentRiskBreakdown,
      riskTimeline: this.riskTimeline,
      activeAgents,
      nodeDensity: nodeDensityObj,
      edgeDensity: edgeDensityObj,
      isRunning: this.isRunning,
      stats: {
         nodes: this.nodes.length,
         edges: this.edges.length,
         spawned: this.agentsSpawnedSoFar,
         walking: activeWalking,
         queued: activeQueued,
         rerouted: activeRerouted,
         exited: this.exitedAgentsCount,
         congestedEdges: this.bottlenecks.length,
         avgSpeed: agentsWithSpeed > 0 ? (totalSpeed / agentsWithSpeed) : 0,
         peakDensity: this.peakDensity,
         peakRisk: this.peakRiskScore
      },
      debugAgent: debugInfo,
      exitUtilization: (() => {
         const util: Record<string, number> = {};
         this.nodes.filter(n => {
            const cat = this.getNodeCategory(n);
            return cat === 'exit' || cat === 'emergency';
         }).forEach(n => {
            const count = this.nodeOccupancy.get(n.id) || 0;
            const cap = n.data?.capacity || 200;
            util[n.data?.label || n.id] = Math.round((count / cap) * 100);
         });
         return util;
      })(),
      destinationDistribution: (() => {
         const dist: Record<string, number> = {};
         this.agents.filter(a => a.state !== "EXITED").forEach(a => {
            const destLabel = this.nodeMap.get(a.destinationNodeId)?.data?.label || a.destinationNodeId;
            dist[destLabel] = (dist[destLabel] || 0) + 1;
         });
         return dist;
      })(),
      intentDistribution: (() => {
         const dist: Record<string, number> = {};
         this.agents.filter(a => a.state !== "EXITED").forEach(a => {
            dist[a.intent] = (dist[a.intent] || 0) + 1;
         });
         return dist;
      })()
    });
  }
}
