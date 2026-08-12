import { Router } from "express";
import { getAuthClient } from "../supabase";

export const venueRoutes = Router();

// GET all venues for the user's organization
venueRoutes.get("/", async (req: any, res) => {
  try {
    const client = getAuthClient(req);
    const { data: venues, error } = await client
      .from("venues")
      .select(`
        id, name, description, status, version, created_at,
        venue_nodes ( node_key, node_type, label, position_x, position_y, capacity, properties ),
        venue_edges ( edge_key, source_node_key, target_node_key, weight, capacity, properties )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform back to the frontend's expected format (nodes & edges instead of venue_nodes & venue_edges)
    const formattedVenues = venues.map(v => ({
      ...v,
      nodes: v.venue_nodes.map((n: any) => {
        const { style, className, ...dataProps } = n.properties || {};
        return {
          id: n.node_key,
          type: n.node_type,
          position: { x: n.position_x, y: n.position_y },
          style,
          className,
          data: { label: n.label, capacity: n.capacity, ...dataProps }
        };
      }),
      edges: v.venue_edges.map((e: any) => {
        const { style, className, animated, markerEnd, markerStart, type, ...dataProps } = e.properties || {};
        return {
          id: e.edge_key,
          source: e.source_node_key,
          target: e.target_node_key,
          type: type || "smoothstep",
          style,
          className,
          animated,
          markerEnd,
          markerStart,
          data: { weight: e.weight, capacity: e.capacity, ...dataProps }
        };
      })
    }));

    res.json(formattedVenues);
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// GET single venue
venueRoutes.get("/:id", async (req: any, res) => {
  try {
    const client = getAuthClient(req);
    const { data: venue, error } = await client
      .from("venues")
      .select(`
        *,
        venue_nodes (*),
        venue_edges (*)
      `)
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!venue) return res.status(404).json({ error: { message: "Not found" } });

    // Transform
    const formattedVenue = {
      ...venue,
      nodes: venue.venue_nodes.map((n: any) => {
        const { style, className, ...dataProps } = n.properties || {};
        return {
          id: n.node_key,
          type: n.node_type,
          position: { x: n.position_x, y: n.position_y },
          style,
          className,
          data: { label: n.label, capacity: n.capacity, ...dataProps }
        };
      }),
      edges: venue.venue_edges.map((e: any) => {
        const { style, className, animated, markerEnd, markerStart, type, ...dataProps } = e.properties || {};
        return {
          id: e.edge_key,
          source: e.source_node_key,
          target: e.target_node_key,
          type: type || "smoothstep",
          style,
          className,
          animated,
          markerEnd,
          markerStart,
          data: { weight: e.weight, capacity: e.capacity, ...dataProps }
        };
      })
    };

    res.json(formattedVenue);
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// POST (Create or fully replace) venue
venueRoutes.post("/", async (req: any, res) => {
  try {
    let { id, name, description, nodes, edges, organization_id } = req.body;
    const client = getAuthClient(req);
    const user = req.user;
    
    // The default demo venue uses the string "demo-venue" which is not a valid UUID.
    // If the user is saving the demo venue for the first time, strip the ID so Supabase generates a valid UUID.
    if (id === "demo-venue") {
        id = undefined;
    }
    
    // Default to the first org if not provided, assuming the user is a member
    let orgId = organization_id;
    if (!orgId) {
       const { data: orgs } = await client.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1);
       if (orgs && orgs.length > 0) {
           orgId = orgs[0].organization_id;
       } else {
           // Generate ID in Node.js to avoid needing to .select() which triggers RLS errors
           const crypto = await import("crypto");
           const newOrgId = crypto.randomUUID();
           
           const { error: orgError } = await client.from("organizations").insert({
               id: newOrgId,
               name: "My Organization",
               slug: "org-" + user.id.substring(0, 8),
               created_by: user.id
           });
           
           if (orgError) throw orgError;
           orgId = newOrgId;
           
           // Add them as a member
           const { error: memError } = await client.from("organization_members").insert({
               organization_id: orgId,
               user_id: user.id,
               role: "owner"
           });
           if (memError) throw memError;
       }
    }

    // Upsert the venue metadata
    const { data: venueData, error: venueError } = await client
      .from("venues")
      .upsert({
        id: id || undefined,
        name: name || "New Venue",
        description,
        organization_id: orgId,
        created_by: user.id
      })
      .select()
      .single();

    if (venueError) throw venueError;

    const venueId = venueData.id;

    // We can run these in parallel or sequential. Let's delete existing nodes/edges and insert new ones.
    if (id) {
       await client.from("venue_nodes").delete().eq("venue_id", venueId);
       await client.from("venue_edges").delete().eq("venue_id", venueId);
    }

    // Insert Nodes
    if (nodes && nodes.length > 0) {
      const nodeInserts = nodes.map((n: any) => {
        const { label, capacity, ...properties } = n.data || {};
        const { style, className } = n;
        return {
          venue_id: venueId,
          node_key: n.id,
          node_type: n.type || "default",
          label: label || n.id,
          position_x: n.position?.x || 0,
          position_y: n.position?.y || 0,
          capacity: capacity || null,
          properties: { ...properties, style, className }
        };
      });
      const { error: nodeError } = await client.from("venue_nodes").insert(nodeInserts);
      if (nodeError) throw nodeError;
    }

    // Insert Edges
    if (edges && edges.length > 0) {
      const edgeInserts = edges.map((e: any) => {
        const { weight, capacity, ...properties } = e.data || {};
        const { style, className, animated, markerEnd, markerStart, type } = e;
        return {
          venue_id: venueId,
          edge_key: e.id,
          source_node_key: e.source,
          target_node_key: e.target,
          weight: weight || null,
          capacity: capacity || null,
          properties: { ...properties, style, className, animated, markerEnd, markerStart, type }
        };
      });
      const { error: edgeError } = await client.from("venue_edges").insert(edgeInserts);
      if (edgeError) throw edgeError;
    }

    // Return the inserted data
    res.json({ ...venueData, nodes, edges });
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// PUT (Update metadata only)
venueRoutes.put("/:id", async (req: any, res) => {
  try {
    const client = getAuthClient(req);
    const { data: venue, error } = await client
      .from("venues")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(venue);
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message } });
  }
});
