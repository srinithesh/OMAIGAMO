import React, { useState, useCallback } from 'react';
import { ProcessedVehicleData, ReportSections, AnalysisStep } from './types';
import { UploadView } from './components/UploadView';
import { DashboardView } from './components/DashboardView';
import { AnalysisProgressView } from './components/AnalysisProgressView';
import { LiveAnalysisView } from './components/LiveAnalysisView';
import { startAnalysis } from './services/apiService';
import { generateReport } from './services/pdfService';

type AppMode = 'upload' | 'live' | 'loading' | 'dashboard';

const initialAnalysisSteps: AnalysisStep[] = [
    { title: 'Initializing in-browser analysis engine...', status: 'pending' },
    { title: 'Processing transaction logs locally...', status: 'pending' },
    { title: 'Correlating datasets & generating compliance report...', status: 'pending' },
    { title: 'Finalizing results...', status: 'pending' },
];

function App() {
    const [appMode, setAppMode] = useState<AppMode>('upload');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ProcessedVehicleData[] | null>(null);
    const [parsingError, setParsingError] = useState<string | null>(null);
    const [analysisProgress, setAnalysisProgress] = useState<AnalysisStep[]>(initialAnalysisSteps);

    const runAnalysis = useCallback(async (videoFile: File, transactionLog: string, yoloModelFile: File) => {
        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
        const updateStepStatus = (index: number, status: AnalysisStep['status']) => {
            setAnalysisProgress(prev => prev.map((step, i) => {
                if (i < index) return { ...step, status: 'complete' };
                if (i === index) return { ...step, status };
                return { ...step, status: 'pending' };
            }));
        };
    
        try {
            // Step 0: Initializing
            updateStepStatus(0, 'in-progress');
            
            // This now represents the local processing time
            const processedDataPromise = startAnalysis(
                yoloModelFile,
                videoFile,
                transactionLog
            );

            // Simulate progress for a better user experience
            await wait(1000);
            updateStepStatus(0, 'complete');
            updateStepStatus(1, 'in-progress');
            await wait(1500);
            updateStepStatus(1, 'complete');
            updateStepStatus(2, 'in-progress');

            const processedData = await processedDataPromise; // Wait for the local worker to finish
            
            updateStepStatus(2, 'complete');
            updateStepStatus(3, 'in-progress');
            await wait(500);
            updateStepStatus(3, 'complete');
            
            setAnalysisResult(processedData);
            setAppMode('dashboard');

        } catch (error) {
            console.error("Failed to process data:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
            setParsingError(errorMessage);
            setAppMode('upload'); // Go back to upload screen on error
        }
    }, []);

    const handleAnalyze = useCallback((videoFile: File, transactionLog: string, yoloModelFile: File) => {
        setAppMode('loading');
        setParsingError(null);
        setAnalysisProgress(initialAnalysisSteps); // Reset progress
        runAnalysis(videoFile, transactionLog, yoloModelFile);
    }, [runAnalysis]);
    
    const handleStartLive = useCallback(() => {
        setAppMode('live');
    }, []);

    const handleSessionEnd = useCallback((results: ProcessedVehicleData[]) => {
        setAnalysisResult(results);
        setAppMode('dashboard');
    }, []);

    const handleRefreshData = useCallback(() => {
        if (!analysisResult) return;
        setIsRefreshing(true);
    
        setTimeout(() => {
            const newData = JSON.parse(JSON.stringify(analysisResult)) as ProcessedVehicleData[];
            let vehicleToUpdate = newData.find(v => v.compliance.score < 100);
            
            if (vehicleToUpdate) {
                vehicleToUpdate.rto.insuranceStatus = 'Active';
                vehicleToUpdate.rto.pendingFine = 0;
            } else if (newData.length > 0) {
                vehicleToUpdate = newData[0];
                vehicleToUpdate.rto.insuranceStatus = 'Expired';
                vehicleToUpdate.rto.pendingFine = 750;
            }
            
            if (vehicleToUpdate) {
                // Recalculate compliance for the updated vehicle
                let score = 100;
                const overallStatus: string[] = [];
                const v = vehicleToUpdate;
                if (! (new Date(v.rto.registrationValidTill || 0) > new Date())) { score -= 20; overallStatus.push(`Reg Expired`); }
                if (v.rto.insuranceStatus !== 'Active') { score -= 20; overallStatus.push(`Insurance Expired`); }
                // ... full recalculation logic ...
                v.compliance.score = Math.max(0, score);
                v.compliance.overallStatus = overallStatus;
                v.timestamp = new Date().toISOString();
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
        setAppMode('upload');
    }, []);

    const renderContent = () => {
        switch (appMode) {
            case 'loading':
                return <AnalysisProgressView steps={analysisProgress} />;
            case 'dashboard':
                return (
                    <DashboardView 
                        data={analysisResult || []} 
                        onGenerateReport={handleGenerateReport} 
                        onReset={handleReset}
                        onRefreshData={handleRefreshData}
                        isRefreshing={isRefreshing}
                    />
                );
            case 'live':
                return <LiveAnalysisView onSessionEnd={handleSessionEnd} onReset={handleReset} />;
            case 'upload':
            default:
                return (
                    <UploadView 
                        onAnalyze={handleAnalyze} 
                        isLoading={appMode === 'loading'}
                        parsingError={parsingError}
                        onClearParsingError={handleClearParsingError}
                        onStartLive={handleStartLive}
                    />
                );
        }
    };

    return (
        <div className="min-h-screen">
            {renderContent()}
        </div>
    );
}

export default App;