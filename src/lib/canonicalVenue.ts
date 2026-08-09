import { MarkerType } from "reactflow";

export interface VenueNodeData {
  label: string;
  type: string; // 'entry' | 'exit' | 'emergency' | 'concourse' | 'junction' | 'food_court' | 'food_shop' | 'corridor' | 'waiting' | 'medical' | 'restricted'
  capacity: number;
  description?: string;
}

export interface CanonicalVenue {
  id: string;
  name: string;
  nodes: Array<{
    id: string;
    type: string;
    data: VenueNodeData;
    position: { x: number; y: number };
    style?: any;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data: {
      distance: number;
      capacity: number;
      travelTime: number;
      direction?: "bidirectional" | "one-way";
    };
    markerEnd?: any;
    markerStart?: any;
    animated?: boolean;
  }>;
}

export const CANONICAL_DEMO_VENUE: CanonicalVenue = {
  id: "demo-venue",
  name: "Main Stadium Layout",
  nodes: [
    {
      id: "entry-a",
      type: "input",
      data: { label: "Entry Gate A", type: "entry", capacity: 500, description: "Main north entrance" },
      position: { x: 300, y: 50 },
      style: { backgroundColor: "#22c55e", color: "#000", fontWeight: "bold" }
    },
    {
      id: "concourse",
      type: "default",
      data: { label: "Main Concourse", type: "concourse", capacity: 800, description: "Central distribution hub" },
      position: { x: 300, y: 160 },
      style: { backgroundColor: "#f97316", color: "#000", fontWeight: "bold" }
    },
    {
      id: "junction",
      type: "default",
      data: { label: "Junction", type: "junction", capacity: 400, description: "Central traffic intersection" },
      position: { x: 300, y: 280 },
      style: { backgroundColor: "#a855f7", color: "#000", fontWeight: "bold" }
    },
    {
      id: "food-court",
      type: "default",
      data: { label: "Food Court", type: "food_court", capacity: 300, description: "Main dining concourse" },
      position: { x: 100, y: 280 },
      style: { backgroundColor: "#eab308", color: "#000", fontWeight: "bold" }
    },
    {
      id: "food-shop",
      type: "default",
      data: { label: "Food Shop", type: "food_shop", capacity: 100, description: "Concession stands" },
      position: { x: 100, y: 400 },
      style: { backgroundColor: "#eab308", color: "#000", fontWeight: "bold" }
    },
    {
      id: "exit-a",
      type: "output",
      data: { label: "Exit Gate A", type: "exit", capacity: 600, description: "Primary egress east" },
      position: { x: 500, y: 200 },
      style: { backgroundColor: "#3b82f6", color: "#000", fontWeight: "bold" }
    },
    {
      id: "exit-b",
      type: "output",
      data: { label: "Exit Gate B", type: "exit", capacity: 600, description: "Secondary egress east" },
      position: { x: 500, y: 320 },
      style: { backgroundColor: "#3b82f6", color: "#000", fontWeight: "bold" }
    },
    {
      id: "emergency-exit",
      type: "output",
      data: { label: "Emergency Exit", type: "emergency", capacity: 800, description: "High capacity fire escape" },
      position: { x: 300, y: 420 },
      style: { backgroundColor: "#ef4444", color: "#000", fontWeight: "bold" }
    }
  ],
  edges: [
    {
      id: "e-entry-concourse",
      source: "entry-a",
      target: "concourse",
      data: { distance: 50, capacity: 500, travelTime: 25, direction: "bidirectional" },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: { type: MarkerType.ArrowClosed }
    },
    {
      id: "e-concourse-junction",
      source: "concourse",
      target: "junction",
      data: { distance: 40, capacity: 600, travelTime: 20, direction: "bidirectional" },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: { type: MarkerType.ArrowClosed }
    },
    {
      id: "e-concourse-foodcourt",
      source: "concourse",
      target: "food-court",
      data: { distance: 30, capacity: 300, travelTime: 15, direction: "bidirectional" },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: { type: MarkerType.ArrowClosed }
    },
    {
      id: "e-foodcourt-foodshop",
      source: "food-court",
      target: "food-shop",
      data: { distance: 15, capacity: 100, travelTime: 10, direction: "bidirectional" },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: { type: MarkerType.ArrowClosed }
    },
    {
      id: "e-junction-exita",
      source: "junction",
      target: "exit-a",
      data: { distance: 35, capacity: 600, travelTime: 15, direction: "bidirectional" },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: { type: MarkerType.ArrowClosed }
    },
    {
      id: "e-junction-exitb",
      source: "junction",
      target: "exit-b",
      data: { distance: 35, capacity: 600, travelTime: 15, direction: "bidirectional" },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: { type: MarkerType.ArrowClosed }
    },
    {
      id: "e-junction-emergency",
      source: "junction",
      target: "emergency-exit",
      data: { distance: 20, capacity: 800, travelTime: 10, direction: "one-way" },
      markerEnd: { type: MarkerType.ArrowClosed }
    },
    {
      id: "e-foodshop-emergency",
      source: "food-shop",
      target: "emergency-exit",
      data: { distance: 25, capacity: 400, travelTime: 12, direction: "one-way" },
      markerEnd: { type: MarkerType.ArrowClosed }
    }
  ]
};

export function validateVenueGraph(nodes: any[], edges: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const entries = nodes.filter(n => n.data?.type === 'entry' || (n.data?.label || '').toLowerCase().includes('entry'));
  const exits = nodes.filter(n => n.data?.type === 'exit' || n.data?.type === 'emergency' || (n.data?.label || '').toLowerCase().includes('exit'));

  if (entries.length === 0) errors.push("At least one Entry Gate must exist in the venue graph.");
  if (exits.length === 0) errors.push("At least one Exit Gate or Emergency Exit must exist in the venue graph.");

  nodes.forEach(n => {
    const label = n.data?.label || n.id;
    if (!n.data?.capacity || isNaN(n.data.capacity) || n.data.capacity <= 0) {
      errors.push(`Node '${label}' has invalid capacity (${n.data?.capacity}). Must be > 0.`);
    }
  });

  edges.forEach(e => {
    if (!nodes.some(n => n.id === e.source)) {
      errors.push(`Edge '${e.id}' references missing source node '${e.source}'.`);
    }
    if (!nodes.some(n => n.id === e.target)) {
      errors.push(`Edge '${e.id}' references missing target node '${e.target}'.`);
    }
    if (!e.data?.distance || isNaN(e.data.distance) || e.data.distance <= 0) {
      errors.push(`Edge '${e.id}' has invalid distance. Must be > 0.`);
    }
    if (!e.data?.capacity || isNaN(e.data.capacity) || e.data.capacity <= 0) {
      errors.push(`Edge '${e.id}' has invalid capacity. Must be > 0.`);
    }
    if (!e.data?.travelTime || isNaN(e.data.travelTime) || e.data.travelTime <= 0) {
      errors.push(`Edge '${e.id}' travel time must be > 0.`);
    }
  });

  // Reachability check
  const adjList = new Map<string, string[]>();
  nodes.forEach(n => adjList.set(n.id, []));

  edges.forEach(e => {
    if (adjList.has(e.source)) adjList.get(e.source)!.push(e.target);
    if (e.data?.direction === 'bidirectional') {
      if (adjList.has(e.target)) adjList.get(e.target)!.push(e.source);
    }
  });

  entries.forEach(entry => {
    const visited = new Set<string>();
    const queue = [entry.id];
    visited.add(entry.id);

    let reachedExit = false;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const node = nodes.find(n => n.id === curr);
      if (node && (node.data?.type === 'exit' || node.data?.type === 'emergency' || (node.data?.label || '').toLowerCase().includes('exit'))) {
        reachedExit = true;
        break;
      }

      const neighbors = adjList.get(curr) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (!reachedExit) {
      errors.push(`Entry Gate '${entry.data?.label || entry.id}' has no navigable path to any exit node.`);
    }
  });

  nodes.forEach(n => {
    if (n.data?.type !== 'restricted') {
      const isConnected = edges.some(e => e.source === n.id || e.target === n.id);
      if (!isConnected) {
        errors.push(`Node '${n.data?.label || n.id}' is isolated with no edge connections.`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}
