
import React, { useState, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ProcessedVehicleData, ReportSections, AnalysisStep } from './types';
import { UploadView } from './components/UploadView';
import { DashboardView } from './components/DashboardView';
import { AnalysisProgressView } from './components/AnalysisProgressView';
import { LiveAnalysisView } from './components/LiveAnalysisView';
import { generateReport } from './services/pdfService';
// Data processing and API services are now handled by the backend.
// We still need a way to calculate compliance for the "Refresh" feature on the frontend.
import { calculateCompliance } from './services/dataProcessingService';


const initialAnalysisSteps: AnalysisStep[] = [
    { title: 'Uploading Files to Server...', status: 'pending' },
    { title: 'Initializing AI Engine...', status: 'pending' },
    { title: 'Processing Transaction Data...', status: 'pending' },
    { title: 'Analyzing CCTV Detections via YOLOv9...', status: 'pending' },
    { title: 'Fetching RTO Records...', status: 'pending' },
    { title: 'Correlating Datasets & Finalizing Report...', status: 'pending' },
];


function App() {
    const navigate = useNavigate();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ProcessedVehicleData[] | null>(null);
    const [parsingError, setParsingError] = useState<string | null>(null);
    const [analysisProgress, setAnalysisProgress] = useState<AnalysisStep[]>(initialAnalysisSteps);

    const runAnalysis = useCallback(async (videoFile: File, transactionFile: File) => {
        try {
            const formData = new FormData();
            formData.append('video_file', videoFile);
            formData.append('transaction_file', transactionFile);

            // In a production environment, this URL should be configured via environment variables.
            const backendUrl = 'http://127.0.0.1:8000/api/analyze';

            const response = await fetch(backendUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `Server responded with status: ${response.status}` }));
                throw new Error(errorData.detail || `An unknown server error occurred.`);
            }

            const processedData = await response.json();
            setAnalysisResult(processedData);
            navigate('/dashboard');

        } catch (error) {
            console.error("Failed to process data:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
            setParsingError(errorMessage);
            navigate('/'); // Go back to upload screen on error
        }
    }, [navigate]);

    const handleAnalyze = useCallback((videoFile: File, transactionFile: File) => {
        navigate('/loading');
        setParsingError(null);
        setAnalysisProgress(initialAnalysisSteps); // Reset progress
        runAnalysis(videoFile, transactionFile);
    }, [runAnalysis, navigate]);
    
    const handleStartLive = useCallback(() => {
        navigate('/live');
    }, [navigate]);

    const handleSessionEnd = useCallback((results: ProcessedVehicleData[]) => {
        setAnalysisResult(results);
        navigate('/dashboard');
    }, [navigate]);

    const handleRefreshData = useCallback(() => {
        if (!analysisResult) return;
        setIsRefreshing(true);
    
        setTimeout(() => {
            const newData = JSON.parse(JSON.stringify(analysisResult)) as ProcessedVehicleData[];
            let vehicleToUpdate = newData.find(v => v.compliance.score < 100);
            
            if (vehicleToUpdate) {
                // Example: Simulate a compliance issue being resolved
                vehicleToUpdate.rto.insuranceStatus = 'Active';
                vehicleToUpdate.rto.pendingFine = 0;
            } else if (newData.length > 0) {
                // Example: Simulate a new compliance issue appearing
                vehicleToUpdate = newData[0];
                vehicleToUpdate.rto.insuranceStatus = 'Expired';
                vehicleToUpdate.rto.pendingFine = 750;
            }
            
            if (vehicleToUpdate) {
                // Recalculate compliance for the updated vehicle using the centralized service
                const complianceData = calculateCompliance({
                    plate: vehicleToUpdate.plate,
                    rto: vehicleToUpdate.rto,
                    fueling: vehicleToUpdate.fueling,
                    helmet: vehicleToUpdate.helmet,
                    vehicleType: vehicleToUpdate.vehicleType,
                });
                vehicleToUpdate.compliance = complianceData;
                vehicleToUpdate.timestamp = new Date().toISOString();
            }
    
            setAnalysisResult(newData);
            setIsRefreshing(false);
        }, 1500);
    }, [analysisResult]);

    const handleGenerateReport = useCallback((dataToReport: ProcessedVehicleData[], sections: ReportSections, summaries: Record<string, string>) => {
        if (dataToReport && dataToReport.length > 0) {
            generateReport(dataToReport, sections, summaries);
        }
    }, []);

    const handleClearParsingError = useCallback(() => {
        setParsingError(null);
    }, []);

    const handleReset = useCallback(() => {
        setAnalysisResult(null);
        setParsingError(null);
        setAnalysisProgress(initialAnalysisSteps);
        navigate('/');
    }, [navigate]);

    return (
        <div className="min-h-screen">
            <Routes>
                <Route path="/loading" element={<AnalysisProgressView steps={analysisProgress} />} />
                <Route 
                    path="/dashboard" 
                    element={
                        <DashboardView 
                            data={analysisResult || []} 
                            onGenerateReport={handleGenerateReport} 
                            onReset={handleReset}
                            onRefreshData={handleRefreshData}
                            isRefreshing={isRefreshing}
                        />
                    } 
                />
                <Route 
                    path="/live" 
                    element={<LiveAnalysisView onSessionEnd={handleSessionEnd} onReset={handleReset} />} 
                />
                <Route 
                    path="/" 
                    element={
                        <UploadView 
                            onAnalyze={handleAnalyze} 
                            isLoading={false}
                            parsingError={parsingError}
                            onClearParsingError={handleClearParsingError}
                            onStartLive={handleStartLive}
                        />
                    }
                />
            </Routes>
        </div>
    );
}

export default App;
