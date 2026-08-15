import React, { useState, useCallback, useEffect, useRef } from "react";
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

import { CANONICAL_DEMO_VENUE, validateVenueGraph } from "@/src/lib/canonicalVenue";

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
  const { token, activeOrganization } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [venueId, setVenueId] = useState("");
  const [venueName, setVenueName] = useState("New Venue");
  const [saving, setSaving] = useState(false);
  
  // Modals state
  const [nodeModal, setNodeModal] = useState<any>(null); // null or { mode: 'add'|'edit', nodeType?: any, node?: any }
  const [edgeModal, setEdgeModal] = useState<any>(null); // null or { mode: 'add'|'edit', edge?: any, connection?: any }
  const [alertModal, setAlertModal] = useState<{title: string, message: string} | null>(null);
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    // Load default demo venue if empty
    fetch("/api/venues", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          const latest = data[data.length - 1];
          setVenueId(latest.id);
          setVenueName(latest.name);
          
          // Re-inject styles if they were lost during DB serialization
          const coloredNodes = (latest.nodes || []).map((node: Node) => {
             const nt = NODE_TYPES.find(t => t.id === node.data?.type);
             if (nt) {
               return {
                 ...node,
                 style: { backgroundColor: nt.color, color: '#000', fontWeight: 'bold', padding: '10px', borderRadius: '5px', ...node.style }
               };
             }
             return node;
          });
          
          setNodes(coloredNodes);
          setEdges(latest.edges || []);
        } else {
          loadDemoVenue();
        }
      })
      .catch(console.error);
  }, []);

  const loadDemoVenue = () => {
    setNodes(CANONICAL_DEMO_VENUE.nodes);
    setEdges(CANONICAL_DEMO_VENUE.edges);
    setVenueName(CANONICAL_DEMO_VENUE.name);
    setVenueId(CANONICAL_DEMO_VENUE.id);
  };

  const validateGraph = () => {
    const { valid, errors } = validateVenueGraph(nodes, edges);
    setValidationErrors(errors);
    setValidated(true);
    return valid;
  };

  const handleSave = async () => {
    if (!validateGraph()) return;
    
    setSaving(true);
    try {
      const saveId = venueId || CANONICAL_DEMO_VENUE.id;
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: saveId, name: venueName, nodes, edges, organization_id: activeOrganization?.id })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "Server returned an error");
      }
      const saved = await res.json();
      setVenueId(saved.id);
      setAlertModal({ title: "Success", message: "Venue layout saved successfully to database!" });
    } catch (e: any) {
      console.error(e);
      setAlertModal({ title: "Error", message: `Failed to save venue layout: ${e.message}` });
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
          <Button variant="outline" onClick={() => { setNodes([]); setEdges([]); setVenueId(""); setVenueName("New Venue"); }}>New Venue</Button>
          <input 
             value={venueName} 
             onChange={(e) => setVenueName(e.target.value)} 
             className="bg-background/50 border border-border/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <div className="flex space-x-2">
            <Button variant="outline" onClick={loadDemoVenue}>
              Reset to Demo
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Layout"}
            </Button>
          </div>
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
                style={{ borderLeft: `4px solid ${nt.color}` }}
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
          <div className="p-4 overflow-y-auto text-sm space-y-3 flex-1">
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
                  id: `${nodeModal.nodeType.id}-${Date.now()}`,
                  type: nodeModal.nodeType.type,
                  data: { label: name, type: nodeModal.nodeType.id, capacity, description },
                  position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
                  style: { backgroundColor: nodeModal.nodeType.color, color: '#000', fontWeight: 'bold', padding: '10px', borderRadius: '5px' }
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
                  <input name="name" required defaultValue={nodeModal.node?.data?.label || `${nodeModal.nodeType.label} ${nodes.length + 1}`} className="w-full bg-background border border-border p-2 rounded text-sm" />
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
                  id: `e-${Date.now()}`,
                  source: edgeModal.connection.source,
                  target: edgeModal.connection.target,
                  data: newEdgeData,
                  markerEnd: { type: MarkerType.ArrowClosed },
                  markerStart: direction === 'bidirectional' ? { type: MarkerType.ArrowClosed } : undefined
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

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card border border-border p-6 rounded-lg shadow-2xl w-[400px]">
            <h3 className="text-lg font-bold mb-3">{alertModal.title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{alertModal.message}</p>
            <div className="flex justify-end">
              <Button onClick={() => setAlertModal(null)}>OK</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
