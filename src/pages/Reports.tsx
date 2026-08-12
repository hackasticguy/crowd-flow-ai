import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { FileText, Download } from "lucide-react";
import { useStore } from "@/src/lib/store";
import { supabase } from "@/src/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports() {
  const { token } = useStore();
  const [simulations, setSimulations] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    fetch("/api/simulate", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSimulations(data);
        } else {
          console.error("Failed to load simulations", data);
          setSimulations([]);
        }
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setErrorMsg("Failed to connect to database");
      });
  }, [token]);

  const downloadCSV = () => {
    try {
      if (simulations.length === 0) throw new Error("No data to export");
      const headers = "Simulation ID,Venue,Date,Crowd Size,Event Schedule,Current Risk,Peak Risk,Crowd Density,Queue Ratio,Exit Util,Blocked Path,Average Density,Peak Density,Bottlenecks,AI Recommendation,Latency,Model,Dataset Samples,People Detected,Calibration\n";
      const csv = simulations.map(sim => {
        const btl = sim.bottlenecks ? sim.bottlenecks.join("; ") : "";
        const recs = sim.recommendations ? sim.recommendations.replace(/"/g, '""').replace(/\n/g, " ") : "";
        const avgDensity = sim.averageDensity?.toFixed(2) || 0;
        const peakDensity = sim.peakDensity || 0;
        const peakRisk = sim.peakRiskScore?.toFixed(1) || sim.riskScore?.toFixed(1) || 0;
        const cd = sim.riskBreakdown?.crowdDensity?.toFixed(2) || 0;
        const qr = sim.riskBreakdown?.queueRatio?.toFixed(2) || 0;
        const eu = sim.riskBreakdown?.exitUtilization?.toFixed(2) || 0;
        const bp = sim.riskBreakdown?.blockedPathRatio?.toFixed(2) || 0;
        const modelName = sim.modelName || "Microsoft Phi-3-mini-4k-instruct";
        const ds = sim.datasetMetrics?.samplesLoaded || 0;
        const pd = sim.datasetMetrics?.peopleDetected || 0;
        const cal = sim.datasetMetrics?.calibrationMultiplier?.toFixed(2) || 1.0;
        return `"${sim.id}","${sim.venueId}","${sim.timestamp}","${sim.crowdSize}","${sim.eventSchedule || 'Normal'}","${sim.riskScore}","${peakRisk}","${cd}","${qr}","${eu}","${bp}","${avgDensity}","${peakDensity}","${btl}","${recs}","${sim.inferenceLatency}","${modelName}","${ds}","${pd}","${cal}"`;
      }).join("\n");
      
      const blob = new Blob([headers + csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', 'crowdflow_reports.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Upload to Supabase Storage
      const fileName = `report_${Date.now()}.csv`;
      supabase.storage.from('reports').upload(fileName, blob).then(async ({ data, error }) => {
        if (!error && data) {
           const { data: urlData } = supabase.storage.from('reports').getPublicUrl(fileName);
           await supabase.from('reports').insert([{
             organization_id: useStore.getState().activeOrganization?.id,
             created_by: useStore.getState().user?.id,
             name: 'CSV Export',
             report_type: 'csv',
             file_path: data.path,
             file_url: urlData.publicUrl,
             status: 'completed'
           }]);
        }
      });

      setSuccessMsg("CSV exported and saved successfully");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) {
      setErrorMsg(`CSV Export Failed: ${e.message}`);
      console.error(e);
    }
  };

  const downloadPDF = () => {
    try {
      if (simulations.length === 0) throw new Error("No data to export");
      const doc = new jsPDF();
      
      doc.setFontSize(24);
      doc.text("CrowdFlow AI", 14, 22);
      doc.setFontSize(16);
      doc.text("Simulation Summary", 14, 32);
      doc.setFontSize(11);
      doc.text(`Date: ${new Date().toLocaleString()}`, 14, 40);
      
      const tableData = simulations.map(sim => [
        sim.id.substring(0, 8),
        sim.venueId.substring(0, 8) + '...',
        sim.crowdSize,
        sim.eventSchedule || 'Normal',
        `${sim.riskScore?.toFixed(1) || 0}%`,
        `${sim.peakRiskScore?.toFixed(1) || sim.riskScore?.toFixed(1) || 0}%`,
        sim.bottlenecks?.length || 0,
        sim.inferenceLatency ? `${sim.inferenceLatency}ms` : "N/A",
        sim.datasetMetrics?.calibrationMultiplier ? `${sim.datasetMetrics.calibrationMultiplier.toFixed(2)}x` : "1.00x",
      ]);

      autoTable(doc, {
        startY: 50,
        head: [['ID', 'Venue', 'Crowd', 'Schedule', 'Curr Risk', 'Peak Risk', 'Bottlenecks', 'Latency', 'Dataset Calib']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8, cellPadding: 2 }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 100;
      
      // Also add AI Recommendation overview
      doc.setFontSize(14);
      doc.text("Latest AI Recommendations:", 14, finalY + 15);
      doc.setFontSize(10);
      
      let yOffset = finalY + 25;
      simulations.slice(0, 3).forEach(sim => {
         let recText = sim.recommendations ? sim.recommendations.substring(0, 150) : "None";
         if (recText.includes("LOCAL SAFETY FALLBACK")) recText = "LOCAL SAFETY FALLBACK";
         doc.text(`${sim.id.substring(0,8)}: ${recText}...`, 14, yOffset);
         yOffset += 10;
      });

      doc.setFontSize(12);
      doc.text("Conclusion", 14, yOffset + 10);
      doc.setFontSize(10);
      doc.text("The simulation data shows the impact of crowd size on venue safety. Detailed AI reasoning is available in the individual CSV export.", 14, yOffset + 20);

      doc.save('crowdflow_reports.pdf');
      
      // Upload to Supabase Storage
      const pdfBlob = doc.output('blob');
      const fileName = `report_${Date.now()}.pdf`;
      supabase.storage.from('reports').upload(fileName, pdfBlob).then(async ({ data, error }) => {
        if (!error && data) {
           const { data: urlData } = supabase.storage.from('reports').getPublicUrl(fileName);
           await supabase.from('reports').insert([{
             organization_id: useStore.getState().activeOrganization?.id,
             created_by: useStore.getState().user?.id,
             name: 'PDF Export',
             report_type: 'pdf',
             file_path: data.path,
             file_url: urlData.publicUrl,
             status: 'completed'
           }]);
        }
      });

      setSuccessMsg('PDF exported and saved successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
       setErrorMsg(`PDF Export Failed: ${e.message}`);
       console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports & Export</h2>
          <p className="text-muted-foreground">Historical data and PDF/CSV generation.</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" className="bg-card border-border" onClick={downloadCSV}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="default" onClick={downloadPDF}>
            <FileText className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>
      
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded flex justify-between items-center">
          <span>{errorMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setErrorMsg("")}>Dismiss</Button>
        </div>
      )}

      <Card className="bg-card rounded-xl border border-border shadow-inner">
        <CardHeader>
          <CardTitle>Recent Simulation Logs</CardTitle>
          <CardDescription>Review past runs and AI recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          {simulations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No reports generated yet. Run a simulation first.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {simulations.map((sim) => (
                <div key={sim.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors">
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="font-semibold text-lg">Crowd: {sim.crowdSize}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        sim.riskScore > 75 ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'
                      }`}>
                        Risk: {sim.riskScore?.toFixed(1)}% (Peak: {sim.peakRiskScore?.toFixed(1) || sim.riskScore?.toFixed(1)}%)
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sim.timestamp).toLocaleString()} | Venue ID: {sim.venueId}
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <Button variant="secondary" size="sm" className="cursor-pointer" onClick={() => setSelectedReport(sim)}>
                      <FileText className="w-4 h-4 mr-2" /> View Full Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card border border-border p-6 rounded-lg shadow-2xl w-11/12 max-w-2xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 border-b border-border pb-2">Simulation Report Details</h3>
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground block text-xs">Simulation ID</span> <span className="font-mono">{selectedReport.id}</span></div>
                <div><span className="text-muted-foreground block text-xs">Date</span> {new Date(selectedReport.timestamp).toLocaleString()}</div>
                <div><span className="text-muted-foreground block text-xs">Venue ID</span> {selectedReport.venueId}</div>
                <div><span className="text-muted-foreground block text-xs">Crowd Size</span> {selectedReport.crowdSize}</div>
                <div><span className="text-muted-foreground block text-xs">Peak Risk</span> <span className="font-bold text-rose-400">{selectedReport.peakRiskScore?.toFixed(1) || selectedReport.riskScore?.toFixed(1)}%</span></div>
                <div><span className="text-muted-foreground block text-xs">Average Risk</span> {selectedReport.riskScore?.toFixed(1)}%</div>
                <div><span className="text-muted-foreground block text-xs">AI Model</span> {selectedReport.modelName || 'Mistral-7B'}</div>
                <div><span className="text-muted-foreground block text-xs">Inference Latency</span> {selectedReport.inferenceLatency || 'N/A'} ms</div>
              </div>
              
              {selectedReport.bottlenecks && selectedReport.bottlenecks.length > 0 && (
                <div>
                  <h4 className="font-semibold text-rose-400 border-b border-border/50 pb-1 mb-2">Identified Bottlenecks</h4>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                    {selectedReport.bottlenecks.map((b: string, i: number) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}

              {selectedReport.recommendations && (
                <div>
                  <h4 className="font-semibold text-primary border-b border-border/50 pb-1 mb-2">AI Strategy & Recommendations</h4>
                  {(() => {
                    try {
                      const aiData = JSON.parse(selectedReport.recommendations);
                      return (
                        <div className="space-y-3 mt-2">
                          <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md border border-border/50">
                            <span className="font-medium text-muted-foreground">Assessed Risk Level</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              aiData.riskLevel === 'CRITICAL' ? 'bg-destructive/20 text-destructive' :
                              aiData.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-500' :
                              'bg-emerald-500/20 text-emerald-500'
                            }`}>
                              {aiData.riskLevel || 'UNKNOWN'}
                            </span>
                          </div>
                          
                          <div className="bg-muted/30 p-3 rounded-md border border-border/50">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Recommended Action</span>
                            <p className="text-sm text-foreground">{aiData.recommendedAction}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted/30 p-3 rounded-md border border-border/50">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Target Exit</span>
                              <p className="text-sm text-foreground">{aiData.recommendedExit || 'N/A'}</p>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-md border border-border/50">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Reroute Target</span>
                              <p className="text-sm text-foreground">{aiData.reroutePercentage ? `${aiData.reroutePercentage}% of crowd` : 'N/A'}</p>
                            </div>
                          </div>

                          <div className="bg-muted/30 p-3 rounded-md border border-border/50">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">AI Reasoning</span>
                            <p className="text-sm text-muted-foreground italic border-l-2 border-primary/50 pl-2">{aiData.reason}</p>
                          </div>
                        </div>
                      );
                    } catch (e) {
                      return (
                        <div className="p-4 bg-muted/50 border border-border/50 rounded-md text-muted-foreground whitespace-pre-wrap font-mono text-xs leading-relaxed overflow-x-auto">
                          {selectedReport.recommendations}
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
            <div className="flex justify-end mt-8">
              <Button onClick={() => setSelectedReport(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
