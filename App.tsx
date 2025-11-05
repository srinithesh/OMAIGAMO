import React, { useState, useCallback } from 'react';
import { ProcessedVehicleData, Transaction, AiDetection, RtoData, ReportSections, AnalysisStep } from './types';
import { UploadView } from './components/UploadView';
import { DashboardView } from './components/DashboardView';
import { AnalysisProgressView } from './components/AnalysisProgressView';
import { LiveAnalysisView } from './components/LiveAnalysisView';
import { startAnalysis } from './services/apiService';
import { generateReport } from './services/pdfService';

type AppMode = 'upload' | 'live' | 'loading' | 'dashboard';

const initialAnalysisSteps: AnalysisStep[] = [
    { title: 'Uploading files to analysis server...', status: 'pending' },
    { title: 'Backend: Processing video & logs...', status: 'pending' },
    { title: 'Correlating datasets & generating report...', status: 'pending' },
    { title: 'Finalizing compliance results...', status: 'pending' },
];


const processData = (transactions: Transaction[], aiDetections: AiDetection[], rtoDatabase: Record<string, RtoData>): ProcessedVehicleData[] => {
    const discrepancyCounts: Record<string, number> = {};
    const suspiciousSessions = new Set<string>();
    
    // First pass to identify suspicious fueling sessions based on refined logic
    transactions.forEach(tx => {
        const detection = aiDetections.find(d => d.plate === tx.plate);
        if (detection) {
            const difference = tx.billedLiters - detection.detectedLiters;
            const absDifference = Math.abs(difference);

            // Calculate percentage difference, handle division by zero or tiny values
            const percentageDifference = tx.billedLiters > 0.1 ? (absDifference / tx.billedLiters) * 100 : 0;

            // A session is suspicious if the absolute difference is over 5 Liters,
            // or if the difference is more than 10% AND over 1 Liter.
            // This avoids flagging tiny, insignificant discrepancies on small fuel amounts.
            const isSuspicious = absDifference > 5.0 || (percentageDifference > 10 && absDifference > 1.0);
            
            if (isSuspicious) {
                suspiciousSessions.add(tx.plate);
                // Count discrepancies per station
                discrepancyCounts[tx.stationId] = (discrepancyCounts[tx.stationId] || 0) + 1;
            }
        }
    });

    return transactions.map(tx => {
        const detection = aiDetections.find(d => d.plate === tx.plate) || {} as Partial<AiDetection>;
        const rto = rtoDatabase[tx.plate] || {} as Partial<RtoData>;

        const difference = tx.billedLiters - (detection.detectedLiters || tx.billedLiters);
        let discrepancyFlag: ProcessedVehicleData['fueling']['discrepancyFlag'] = 'OK';
        
        // A specific transaction is only flagged if it was one of the suspicious ones.
        // If the associated station has 3 or more suspicious sessions, it's flagged as a potential fault.
        if (suspiciousSessions.has(tx.plate)) {
            if (discrepancyCounts[tx.stationId] >= 3) {
                discrepancyFlag = 'Potential Station Fault';
            } else {
                discrepancyFlag = 'Suspicious';
            }
        }
        
        let score = 100;
        const overallStatus: string[] = [];
        
        const isRegValid = new Date(rto.registrationValidTill || 0) > new Date();
        const isPucValid = new Date(rto.pollutionValidTill || 0) > new Date();
        
        if (!isRegValid) { score -= 20; overallStatus.push(`Reg Expired for ${tx.plate}`); }
        if (rto.insuranceStatus !== 'Active') { score -= 20; overallStatus.push(`Insurance Expired for ${tx.plate}`); }
        if (!isPucValid) { score -= 20; overallStatus.push(`PUC Expired for ${tx.plate}`); }
        if (rto.pendingFine > 0) { score -= 20; overallStatus.push(`Fine Pending: ₹${rto.pendingFine} on ${tx.plate}`); }
        if (rto.roadTaxStatus !== 'Paid') { score -= 20; overallStatus.push(`Tax Due for ${tx.plate}`); }
        if (discrepancyFlag !== 'OK') { score -= 20; overallStatus.push(`Fueling Discrepancy on ${tx.plate}`); }
        if (detection.vehicleType === '2-Wheeler' && detection.helmet === false) {
            overallStatus.push(`No Helmet on ${tx.plate}`);
        }
        
        return {
            plate: tx.plate,
            vehicleType: detection.vehicleType || 'Other',
            helmet: detection.helmet === undefined ? null : detection.helmet,
            timestamp: tx.timestamp,
            rto: rto as RtoData,
            amount: tx.amount,
            fueling: {
                billed: tx.billedLiters,
                detected: detection.detectedLiters || tx.billedLiters,
                difference,
                discrepancyFlag,
                microBalance: tx.amount > 0 ? tx.amount - Math.floor(tx.amount) : 0,
            },
            compliance: {
                score: Math.max(0, score),
                fineStatus: rto.pendingFine > 0 ? `₹${rto.pendingFine}` : 'OK',
                insuranceStatus: rto.insuranceStatus || 'Expired',
                pucStatus: isPucValid ? 'Valid' : 'Expired',
                taxStatus: rto.roadTaxStatus || 'Due',
                registrationStatus: isRegValid ? 'Valid' : 'Expired',
                overallStatus,
            }
        };
    });
};


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
            // Step 0: Uploading files
            updateStepStatus(0, 'in-progress');
            const { transactions, aiDetections, rtoData } = await startAnalysis(
                yoloModelFile,
                videoFile,
                transactionLog
            );
            updateStepStatus(0, 'complete');

            // Step 1: Backend Processing (simulated wait as API returns instantly)
            updateStepStatus(1, 'in-progress');
            await wait(1000); 
            updateStepStatus(1, 'complete');

            // Step 2: Correlating
            updateStepStatus(2, 'in-progress');
            const processed = processData(transactions, aiDetections, rtoData);
            await wait(500);
            updateStepStatus(2, 'complete');
            
            // Step 3: Finalizing
            updateStepStatus(3, 'in-progress');
            await wait(500);
            updateStepStatus(3, 'complete');
            
            setAnalysisResult(processed);
            setAppMode('dashboard');

        } catch (error) {
            console.error("Failed to process data:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
            // The error message from apiService is now specific enough to be displayed directly.
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