export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          role: string
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          role?: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
      }
      venues: {
        Row: {
          id: string
          organization_id: string
          created_by: string
          name: string
          description: string | null
          status: string
          version: number
          metadata: Json
          thumbnail_path: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          created_by: string
          name: string
          description?: string | null
          status?: string
          version?: number
          metadata?: Json
          thumbnail_path?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          created_by?: string
          name?: string
          description?: string | null
          status?: string
          version?: number
          metadata?: Json
          thumbnail_path?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      venue_nodes: {
        Row: {
          id: string
          venue_id: string
          node_key: string
          node_type: string
          label: string
          position_x: number
          position_y: number
          capacity: number | null
          properties: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          node_key: string
          node_type: string
          label: string
          position_x?: number
          position_y?: number
          capacity?: number | null
          properties?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          node_key?: string
          node_type?: string
          label?: string
          position_x?: number
          position_y?: number
          capacity?: number | null
          properties?: Json
          created_at?: string
          updated_at?: string
        }
      }
      venue_edges: {
        Row: {
          id: string
          venue_id: string
          edge_key: string
          source_node_key: string
          target_node_key: string
          weight: number | null
          capacity: number | null
          properties: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          edge_key: string
          source_node_key: string
          target_node_key: string
          weight?: number | null
          capacity?: number | null
          properties?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          edge_key?: string
          source_node_key?: string
          target_node_key?: string
          weight?: number | null
          capacity?: number | null
          properties?: Json
          created_at?: string
          updated_at?: string
        }
      }
      simulations: {
        Row: {
          id: string
          venue_id: string
          organization_id: string
          created_by: string
          status: string
          crowd_size: number
          event_schedule: string | null
          started_at: string | null
          paused_at: string | null
          completed_at: string | null
          risk_score: number | null
          peak_risk_score: number | null
          peak_density: number | null
          average_density: number | null
          rerouted_agents: number
          exited_agents: number
          confidence: number | null
          inference_latency: number | null
          model_name: string | null
          calibration_multiplier: number | null
          hf_dataset_info: string | null
          dataset_metrics: Json
          risk_breakdown: Json
          risk_timeline: Json
          bottlenecks: Json
          final_metrics: Json
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          organization_id: string
          created_by: string
          status?: string
          crowd_size: number
          event_schedule?: string | null
          started_at?: string | null
          paused_at?: string | null
          completed_at?: string | null
          risk_score?: number | null
          peak_risk_score?: number | null
          peak_density?: number | null
          average_density?: number | null
          rerouted_agents?: number
          exited_agents?: number
          confidence?: number | null
          inference_latency?: number | null
          model_name?: string | null
          calibration_multiplier?: number | null
          hf_dataset_info?: string | null
          dataset_metrics?: Json
          risk_breakdown?: Json
          risk_timeline?: Json
          bottlenecks?: Json
          final_metrics?: Json
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          organization_id?: string
          created_by?: string
          status?: string
          crowd_size?: number
          event_schedule?: string | null
          started_at?: string | null
          paused_at?: string | null
          completed_at?: string | null
          risk_score?: number | null
          peak_risk_score?: number | null
          peak_density?: number | null
          average_density?: number | null
          rerouted_agents?: number
          exited_agents?: number
          confidence?: number | null
          inference_latency?: number | null
          model_name?: string | null
          calibration_multiplier?: number | null
          hf_dataset_info?: string | null
          dataset_metrics?: Json
          risk_breakdown?: Json
          risk_timeline?: Json
          bottlenecks?: Json
          final_metrics?: Json
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      simulation_snapshots: {
        Row: {
          id: number
          simulation_id: string
          captured_at: string
          risk_score: number | null
          risk_level: string | null
          crowd_density: number | null
          queue_ratio: number | null
          exit_utilization: number | null
          blocked_path_ratio: number | null
          active_agents: number | null
          exited_agents: number | null
          rerouted_agents: number | null
          node_occupancy: Json
          edge_occupancy: Json
          bottlenecks: Json
          metrics: Json
        }
        Insert: {
          id?: number
          simulation_id: string
          captured_at?: string
          risk_score?: number | null
          risk_level?: string | null
          crowd_density?: number | null
          queue_ratio?: number | null
          exit_utilization?: number | null
          blocked_path_ratio?: number | null
          active_agents?: number | null
          exited_agents?: number | null
          rerouted_agents?: number | null
          node_occupancy?: Json
          edge_occupancy?: Json
          bottlenecks?: Json
          metrics?: Json
        }
        Update: {
          id?: number
          simulation_id?: string
          captured_at?: string
          risk_score?: number | null
          risk_level?: string | null
          crowd_density?: number | null
          queue_ratio?: number | null
          exit_utilization?: number | null
          blocked_path_ratio?: number | null
          active_agents?: number | null
          exited_agents?: number | null
          rerouted_agents?: number | null
          node_occupancy?: Json
          edge_occupancy?: Json
          bottlenecks?: Json
          metrics?: Json
        }
      }
      alerts: {
        Row: {
          id: string
          simulation_id: string
          venue_id: string
          organization_id: string
          created_by: string | null
          alert_type: string
          severity: string
          title: string
          message: string
          node_key: string | null
          acknowledged: boolean
          acknowledged_by: string | null
          acknowledged_at: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          simulation_id: string
          venue_id: string
          organization_id: string
          created_by?: string | null
          alert_type: string
          severity: string
          title: string
          message: string
          node_key?: string | null
          acknowledged?: boolean
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          simulation_id?: string
          venue_id?: string
          organization_id?: string
          created_by?: string | null
          alert_type?: string
          severity?: string
          title?: string
          message?: string
          node_key?: string | null
          acknowledged?: boolean
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      ai_recommendations: {
        Row: {
          id: string
          simulation_id: string
          venue_id: string
          created_by: string | null
          source: string
          model_name: string | null
          prompt: string | null
          raw_response: string | null
          recommendation: Json
          risk_level: string | null
          recommended_action: string | null
          recommended_exit: string | null
          reroute_percentage: number | null
          affected_nodes: Json
          reason: string | null
          expected_risk_reduction: number | null
          confidence: number | null
          inference_latency: number | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          simulation_id: string
          venue_id: string
          created_by?: string | null
          source: string
          model_name?: string | null
          prompt?: string | null
          raw_response?: string | null
          recommendation: Json
          risk_level?: string | null
          recommended_action?: string | null
          recommended_exit?: string | null
          reroute_percentage?: number | null
          affected_nodes?: Json
          reason?: string | null
          expected_risk_reduction?: number | null
          confidence?: number | null
          inference_latency?: number | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          simulation_id?: string
          venue_id?: string
          created_by?: string | null
          source?: string
          model_name?: string | null
          prompt?: string | null
          raw_response?: string | null
          recommendation?: Json
          risk_level?: string | null
          recommended_action?: string | null
          recommended_exit?: string | null
          reroute_percentage?: number | null
          affected_nodes?: Json
          reason?: string | null
          expected_risk_reduction?: number | null
          confidence?: number | null
          inference_latency?: number | null
          status?: string
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          organization_id: string
          venue_id: string | null
          simulation_id: string | null
          created_by: string
          name: string
          report_type: string
          status: string
          summary: string | null
          report_data: Json
          file_path: string | null
          file_url: string | null
          created_at: string
          completed_at: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          venue_id?: string | null
          simulation_id?: string | null
          created_by: string
          name: string
          report_type: string
          status?: string
          summary?: string | null
          report_data?: Json
          file_path?: string | null
          file_url?: string | null
          created_at?: string
          completed_at?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          venue_id?: string | null
          simulation_id?: string | null
          created_by?: string
          name?: string
          report_type?: string
          status?: string
          summary?: string | null
          report_data?: Json
          file_path?: string | null
          file_url?: string | null
          created_at?: string
          completed_at?: string | null
          error_message?: string | null
        }
      }
    }
  }
}
