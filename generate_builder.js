const fs = require('fs');

const content = `import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  MarkerType
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Save, PlusCircle, Trash2, ShieldAlert, CheckCircle, XCircle } from "lucide-react";
import { useStore } from "@/src/lib/store";

const NODE_TYPES = [
  { id: 'entry', label: 'Entry Gate', color: '#22c55e', icon: '🟢', type: 'input' },
  { id: 'exit', label: 'Exit Gate', color: '#3b82f6', icon: '🔵', type: 'output' },
  { id: 'emergency', label: 'Emergency Exit', color: '#ef4444', icon: '🔴', type: 'output' },
  { id: 'corridor', label: 'Walkway / Corridor', color: '#ffffff', icon: '⚪', type: 'default' },
  { id: 'junction', label: 'Junction', color: '#a855f7', icon: '🟣', type: 'default' },
  { id: 'concourse', label: 'Main Concourse', color: '#f97316', icon: '🟠', type: 'default' },
  { id: 'food_court', label: 'Food Court', color: '#eab308', icon: '🟡', type: 'default' },
  { id: 'food_shop', label: 'Food Shop', color: '#eab308', icon: '🟡', type: 'default' },
  { id: 'waiting', label: 'Waiting Area', color: '#0ea5e9', icon: '🔵', type: 'default' },
  { id: 'medical', label: 'Medical Area', color: '#ec4899', icon: '⚕️', type: 'default' },
  { id: 'restricted', label: 'Restricted Area', color: '#64748b', icon: '🚫', type: 'default' }
];

export default function VenueBuilder() {
  const { token } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [venueId, setVenueId] = useState("");
  const [venueName, setVenueName] = useState("New Venue");
  const [saving, setSaving] = useState(false);
  
  // Modals state
  const [nodeModal, setNodeModal] = useState<any>(null); // null or { mode: 'add'|'edit', nodeType?: any, node?: any }
  const [edgeModal, setEdgeModal] = useState<any>(null); // null or { mode: 'add'|'edit', edge?: any, connection?: any }
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    // Load default demo venue if empty
    fetch("/api/venues", { headers: { Authorization: \`Bearer \${token}\` } })
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          const latest = data[data.length - 1];
          setVenueId(latest.id);
          setVenueName(latest.name);
          setNodes(latest.nodes || []);
          setEdges(latest.edges || []);
        } else {
          loadDemoVenue();
        }
      })
      .catch(console.error);
  }, []);

  const loadDemoVenue = () => {
    const demoNodes: Node[] = [
      { id: "entry-a", type: "input", data: { label: "Entry Gate A", type: "entry", capacity: 500, description: "North entrance" }, position: { x: 100, y: 100 }, style: { backgroundColor: '#22c55e', color: '#000', fontWeight: 'bold' } },
      { id: "concourse", type: "default", data: { label: "Main Concourse", type: "concourse", capacity: 1000, description: "Central hub" }, position: { x: 300, y: 100 }, style: { backgroundColor: '#f97316', color: '#000', fontWeight: 'bold' } },
      { id: "food-court", type: "default", data: { label: "Food Court", type: "food_court", capacity: 300, description: "Dining area" }, position: { x: 200, y: 250 }, style: { backgroundColor: '#eab308', color: '#000', fontWeight: 'bold' } },
      { id: "junction", type: "default", data: { label: "Junction", type: "junction", capacity: 400, description: "Intersection" }, position: { x: 450, y: 100 }, style: { backgroundColor: '#a855f7', color: '#000', fontWeight: 'bold' } },
      { id: "exit-a", type: "output", data: { label: "Exit A", type: "exit", capacity: 500, description: "Main exit" }, position: { x: 450, y: 250 }, style: { backgroundColor: '#3b82f6', color: '#000', fontWeight: 'bold' } },
      { id: "emergency-exit", type: "output", data: { label: "Emergency Exit", type: "emergency", capacity: 700, description: "Fire exit" }, position: { x: 600, y: 100 }, style: { backgroundColor: '#ef4444', color: '#000', fontWeight: 'bold' } },
      { id: "food-shop", type: "default", data: { label: "Food Shop", type: "food_shop", capacity: 50, description: "Snacks" }, position: { x: 100, y: 250 }, style: { backgroundColor: '#eab308', color: '#000', fontWeight: 'bold' } },
      { id: "medical", type: "default", data: { label: "Medical Area", type: "medical", capacity: 20, description: "First aid" }, position: { x: 300, y: 350 }, style: { backgroundColor: '#ec4899', color: '#000', fontWeight: 'bold' } },
      { id: "waiting", type: "default", data: { label: "Waiting Area", type: "waiting", capacity: 100, description: "Rest area" }, position: { x: 450, y: 350 }, style: { backgroundColor: '#0ea5e9', color: '#000', fontWeight: 'bold' } },
    ];
    
    const demoEdges: Edge[] = [
      { id: "e1", source: "entry-a", target: "concourse", data: { distance: 50, capacity: 500, travelTime: 30, direction: "one-way" }, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: "e2", source: "concourse", target: "food-court", data: { distance: 20, capacity: 200, travelTime: 10, direction: "bidirectional" }, markerEnd: { type: MarkerType.ArrowClosed }, markerStart: { type: MarkerType.ArrowClosed } },
      { id: "e3", source: "concourse", target: "junction", data: { distance: 40, capacity: 600, travelTime: 20, direction: "bidirectional" }, markerEnd: { type: MarkerType.ArrowClosed }, markerStart: { type: MarkerType.ArrowClosed } },
      { id: "e4", source: "junction", target: "exit-a", data: { distance: 30, capacity: 500, travelTime: 15, direction: "one-way" }, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: "e5", source: "junction", target: "emergency-exit", data: { distance: 10, capacity: 700, travelTime: 5, direction: "one-way" }, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: "e6", source: "food-court", target: "food-shop", data: { distance: 5, capacity: 50, travelTime: 2, direction: "bidirectional" } },
      { id: "e7", source: "food-court", target: "medical", data: { distance: 15, capacity: 50, travelTime: 5, direction: "bidirectional" } },
      { id: "e8", source: "junction", target: "waiting", data: { distance: 10, capacity: 100, travelTime: 5, direction: "bidirectional" } }
    ];
    
    setNodes(demoNodes);
    setEdges(demoEdges);
    setVenueName("Demo Venue");
    setVenueId("");
  };

  const validateGraph = () => {
    const errors: string[] = [];
    
    const entries = nodes.filter(n => n.data.type === 'entry');
    const exits = nodes.filter(n => n.data.type === 'exit' || n.data.type === 'emergency');
    
    if (entries.length === 0) errors.push("At least one Entry Gate exists. (Missing)");
    if (exits.length === 0) errors.push("At least one Exit Gate or Emergency Exit exists. (Missing)");
    
    // Check capacities
    nodes.forEach(n => {
      if (!n.data.capacity || isNaN(n.data.capacity) || n.data.capacity <= 0) {
        errors.push(\`Node '\${n.data.label}' has invalid capacity.\`);
      }
    });
    
    edges.forEach(e => {
      if (!e.data?.distance || isNaN(e.data.distance) || e.data.distance <= 0) {
        errors.push(\`Edge \${e.id} has invalid distance.\`);
      }
      if (!e.data?.capacity || isNaN(e.data.capacity) || e.data.capacity <= 0) {
        errors.push(\`Edge \${e.id} has invalid capacity.\`);
      }
      if (!e.data?.travelTime || isNaN(e.data.travelTime) || e.data.travelTime <= 0) {
        errors.push(\`Edge \${e.id} travel time must be greater than zero.\`);
      }
    });

    // Graph traversal for isolated nodes & reachability
    const adjList = new Map<string, string[]>();
    nodes.forEach(n => adjList.set(n.id, []));
    
    edges.forEach(e => {
      if (adjList.has(e.source)) adjList.get(e.source)!.push(e.target);
      if (e.data?.direction === 'bidirectional') {
        if (adjList.has(e.target)) adjList.get(e.target)!.push(e.source);
      }
    });

    // Check reachability from each entry
    entries.forEach(entry => {
      const visited = new Set<string>();
      const queue = [entry.id];
      visited.add(entry.id);
      
      let reachedExit = false;
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const node = nodes.find(n => n.id === curr);
        if (node && (node.data.type === 'exit' || node.data.type === 'emergency')) {
          reachedExit = true;
          break; // Optimization: as long as it can reach one exit
        }
        
        const neighbors = adjList.get(curr) || [];
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
      
      if (!reachedExit) {
        errors.push(\`Entry Gate '\${entry.data.label}' has no route to an exit.\`);
      }
    });

    // Check isolated nodes
    nodes.forEach(n => {
      if (n.data.type !== 'restricted') {
        // Find if any edge connects to or from this node
        const connected = edges.some(e => e.source === n.id || e.target === n.id);
        if (!connected) {
          errors.push(\`Node '\${n.data.label}' is isolated. (Must be connected or marked Restricted)\`);
        }
      }
    });

    setValidationErrors(errors);
    setValidated(true);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateGraph()) return;
    
    setSaving(true);
    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${token}\`
        },
        body: JSON.stringify({ name: venueName, nodes, edges })
      });
      const saved = await res.json();
      setVenueId(saved.id);
      alert("Venue saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save venue");
    } finally {
      setSaving(false);
    }
  };

  const onConnect = useCallback((params: Connection) => {
    setEdgeModal({ mode: 'add', connection: params });
  }, []);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    const nt = NODE_TYPES.find(t => t.id === node.data.type) || NODE_TYPES[0];
    setNodeModal({ mode: 'edit', node, nodeType: nt });
  };
  
  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setEdgeModal({ mode: 'edit', edge });
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Venue Builder</h2>
          <p className="text-muted-foreground">Design spatial layouts, validate paths, and set capacities.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={loadDemoVenue}>Load Demo Venue</Button>
          <Button variant="outline" onClick={() => { setNodes([]); setEdges([]); setVenueId(""); setVenueName("New Venue"); }}>New Venue</Button>
          <input 
             value={venueName} 
             onChange={(e) => setVenueName(e.target.value)} 
             className="bg-background/50 border border-border/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <Button onClick={handleSave} disabled={saving} className="shadow-lg shadow-primary/20 bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Layout"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden h-[calc(100vh-14rem)]">
        {/* Component Library */}
        <Card className="w-64 bg-card border-border shadow-inner flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-border font-semibold uppercase tracking-wider text-xs text-muted-foreground">
            Component Library
          </div>
          <div className="p-2 space-y-1">
            {NODE_TYPES.map(nt => (
              <Button 
                key={nt.id}
                variant="ghost" 
                className="w-full justify-start text-sm h-9 px-2"
                style={{ borderLeft: \`4px solid \${nt.color}\` }}
                onClick={() => setNodeModal({ mode: 'add', nodeType: nt })}
              >
                <span className="mr-2">{nt.icon}</span> {nt.label}
              </Button>
            ))}
          </div>
        </Card>

        {/* Canvas */}
        <div className="flex-1 rounded-xl overflow-hidden border border-border bg-card shadow-inner relative">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            fitView
            className="bg-transparent"
          >
            <Background color="hsl(var(--muted-foreground))" gap={16} size={1} />
            <Controls className="bg-card border-border fill-foreground" />
            <MiniMap 
               nodeStrokeColor="hsl(var(--primary))" 
               nodeColor="hsl(var(--card))" 
               maskColor="rgba(0,0,0,0.5)" 
               className="bg-card border-border" 
             />
          </ReactFlow>
        </div>
        
        {/* Properties / Validation Panel */}
        <Card className="w-80 bg-card border-border shadow-inner flex flex-col">
          <div className="p-4 border-b border-border font-semibold uppercase tracking-wider text-xs flex justify-between items-center">
            <span>Venue Validation</span>
            <Button size="sm" variant="secondary" onClick={validateGraph} className="h-6 text-xs">Validate</Button>
          </div>
          <div className="p-4 overflow-y-auto text-sm space-y-3">
            {!validated ? (
              <p className="text-muted-foreground text-xs">Run validation to check layout paths and constraints.</p>
            ) : validationErrors.length === 0 ? (
              <div className="text-green-500 flex flex-col gap-2">
                <p className="flex items-center font-semibold"><CheckCircle className="w-4 h-4 mr-2"/> Graph Valid</p>
                <ul className="text-xs space-y-1">
                  <li>✅ At least one Entry Gate exists</li>
                  <li>✅ At least one Exit Gate exists</li>
                  <li>✅ All entry gates have exits</li>
                  <li>✅ All nodes connected</li>
                </ul>
              </div>
            ) : (
              <div className="text-red-400 flex flex-col gap-2">
                <p className="flex items-center font-semibold"><XCircle className="w-4 h-4 mr-2"/> Validation Errors</p>
                <ul className="text-xs space-y-2 list-disc pl-4 text-red-300">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Node Form Modal */}
      {nodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 rounded-lg shadow-xl w-[400px]">
            <h3 className="text-lg font-bold mb-4">{nodeModal.mode === 'add' ? 'Add' : 'Edit'} {nodeModal.nodeType.label}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = fd.get('name') as string;
              const capacity = parseInt(fd.get('capacity') as string);
              const description = fd.get('description') as string;
              
              if (nodeModal.mode === 'add') {
                const newNode: Node = {
                  id: \`\${nodeModal.nodeType.id}-\${Date.now()}\`,
                  type: nodeModal.nodeType.type,
                  data: { label: name, type: nodeModal.nodeType.id, capacity, description },
                  position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
                  style: { backgroundColor: nodeModal.nodeType.color, color: '#000', fontWeight: 'bold' }
                };
                setNodes(ns => [...ns, newNode]);
              } else {
                setNodes(ns => ns.map(n => n.id === nodeModal.node.id ? {
                  ...n,
                  data: { ...n.data, label: name, capacity, description }
                } : n));
              }
              setNodeModal(null);
            }}>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold mb-1 block">Name</label>
                  <input name="name" required defaultValue={nodeModal.node?.data?.label || \`\${nodeModal.nodeType.label} \${nodes.length + 1}\`} className="w-full bg-background border border-border p-2 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Capacity (people)</label>
                  <input name="capacity" type="number" required min="1" defaultValue={nodeModal.node?.data?.capacity || 100} className="w-full bg-background border border-border p-2 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Description</label>
                  <input name="description" defaultValue={nodeModal.node?.data?.description || ''} className="w-full bg-background border border-border p-2 rounded text-sm" />
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                {nodeModal.mode === 'edit' && (
                  <Button type="button" variant="destructive" onClick={() => {
                    setNodes(ns => ns.filter(n => n.id !== nodeModal.node.id));
                    setEdges(es => es.filter(e => e.source !== nodeModal.node.id && e.target !== nodeModal.node.id));
                    setNodeModal(null);
                  }}>Delete Node</Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button type="button" variant="secondary" onClick={() => setNodeModal(null)}>Cancel</Button>
                  <Button type="submit">Save Node</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edge Form Modal */}
      {edgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 rounded-lg shadow-xl w-[400px]">
            <h3 className="text-lg font-bold mb-4">{edgeModal.mode === 'add' ? 'Configure Route' : 'Edit Route'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const distance = parseInt(fd.get('distance') as string);
              const capacity = parseInt(fd.get('capacity') as string);
              const travelTime = parseInt(fd.get('travelTime') as string);
              const direction = fd.get('direction') as string;
              
              const newEdgeData = { distance, capacity, travelTime, direction };
              
              if (edgeModal.mode === 'add') {
                const newEdge: Edge = {
                  id: \`e-\${Date.now()}\`,
                  source: edgeModal.connection.source,
                  target: edgeModal.connection.target,
                  data: newEdgeData,
                  markerEnd: { type: MarkerType.ArrowClosed },
                  markerStart: direction === 'bidirectional' ? { type: MarkerType.ArrowClosed } : undefined,
                  animated: true
                };
                setEdges(es => [...es, newEdge]);
              } else {
                setEdges(es => es.map(e => e.id === edgeModal.edge.id ? {
                  ...e,
                  data: newEdgeData,
                  markerStart: direction === 'bidirectional' ? { type: MarkerType.ArrowClosed } : undefined,
                } : e));
              }
              setEdgeModal(null);
            }}>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold mb-1 block">Distance (meters)</label>
                  <input name="distance" type="number" required min="1" defaultValue={edgeModal.edge?.data?.distance || 50} className="w-full bg-background border border-border p-2 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Capacity (people)</label>
                  <input name="capacity" type="number" required min="1" defaultValue={edgeModal.edge?.data?.capacity || 200} className="w-full bg-background border border-border p-2 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Travel Time (seconds)</label>
                  <input name="travelTime" type="number" required min="1" defaultValue={edgeModal.edge?.data?.travelTime || 30} className="w-full bg-background border border-border p-2 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Direction</label>
                  <select name="direction" defaultValue={edgeModal.edge?.data?.direction || 'bidirectional'} className="w-full bg-background border border-border p-2 rounded text-sm text-foreground">
                    <option value="bidirectional">Bidirectional (Two-way)</option>
                    <option value="one-way">One-way (Source → Target)</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                {edgeModal.mode === 'edit' && (
                  <Button type="button" variant="destructive" onClick={() => {
                    setEdges(es => es.filter(e => e.id !== edgeModal.edge.id));
                    setEdgeModal(null);
                  }}>Delete Edge</Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button type="button" variant="secondary" onClick={() => setEdgeModal(null)}>Cancel</Button>
                  <Button type="submit">Save Route</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`

fs.writeFileSync('src/pages/VenueBuilder.tsx', content);
console.log("VenueBuilder.tsx updated");
