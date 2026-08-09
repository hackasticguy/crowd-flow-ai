import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { FileText, Download } from "lucide-react";
import { useStore } from "@/src/lib/store";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports() {
  const { token } = useStore();
  const [simulations, setSimulations] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetch("/api/simulations", { headers: { Authorization: `Bearer ${token}` } })
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
      setSuccessMsg("CSV exported successfully");
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
      setSuccessMsg('PDF exported successfully');
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
                    <Button variant="secondary" size="sm">
                      <FileText className="w-4 h-4 mr-2" /> View Full Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
