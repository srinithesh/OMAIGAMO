import React, { useState, useCallback } from 'react';
import { ProcessedVehicleData, ReportSections, AnalysisStep } from './types';
import { UploadView } from './components/UploadView';
import { DashboardView } from './components/DashboardView';
import { AnalysisProgressView } from './components/AnalysisProgressView';
import { LiveAnalysisView } from './components/LiveAnalysisView';
import { startAnalysis } from './services/apiService';
import { generateReport } from './services/pdfService';

type AppMode = 'upload' | 'live' | 'loading' | 'dashboard';

// Updated steps to reflect the new client-server architecture with real AI processing
const initialAnalysisSteps: AnalysisStep[] = [
    { title: 'Establishing secure connection to analysis server...', status: 'pending' },
    { title: 'Uploading files for processing...', status: 'pending' },
    { title: 'AI is analyzing video frames with Gemini Vision...', status: 'pending' },
    { title: 'Correlating datasets & generating compliance report...', status: 'pending' },
    { title: 'Receiving final results...', status: 'pending' },
];


export function App() {
    const [appMode, setAppMode] = useState<AppMode>('upload');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ProcessedVehicleData[] | null>(null);
    const [parsingError, setParsingError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>(initialAnalysisSteps);

    const updateStep = (index: number, status: AnalysisStep['status'], progress?: number) => {
        setAnalysisSteps(prevSteps =>
            prevSteps.map((step, i) => {
                if (i < index) return { ...step, status: 'complete', progress: 100 };
                if (i === index) return { ...step, status, progress };
                return { ...step, status: 'pending', progress: 0 };
            })
        );
    };
    
    const runAnalysis = useCallback(async (videoFile: File, transactionLog: string) => {
        setIsLoading(true);
        setAppMode('loading');
        setParsingError(null);
        setAnalysisSteps(initialAnalysisSteps);

        try {
            updateStep(0, 'in-progress', 10);
            await new Promise(res => setTimeout(res, 300));
            updateStep(0, 'complete', 100);

            updateStep(1, 'in-progress', 25);
            // The actual analysis call now happens here, without the model file
            const resultPromise = startAnalysis(videoFile, transactionLog);
            
            // While the backend works, update the frontend steps
            await new Promise(res => setTimeout(res, 1000));
            updateStep(1, 'complete', 100);
            updateStep(2, 'in-progress', 50);

            // Now, wait for the actual result
            const result = await resultPromise;
            updateStep(2, 'complete', 100);

            updateStep(3, 'in-progress', 75);
            await new Promise(res => setTimeout(res, 500));
            updateStep(3, 'complete', 100);
            
            updateStep(4, 'in-progress', 90);
            await new Promise(res => setTimeout(res, 200));
            updateStep(4, 'complete', 100);

            setAnalysisResult(result);
            setAppMode('dashboard');
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
            setParsingError(message);
            setAppMode('upload');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleGenerateReport = useCallback((data: ProcessedVehicleData[], sections: ReportSections, summaries: Record<string, string>) => {
        generateReport(data, sections, summaries);
    }, []);
    
    const handleReset = useCallback(() => {
        setAppMode('upload');
        setAnalysisResult(null);
        setParsingError(null);
        setIsLoading(false);
    }, []);

    const handleRefreshData = useCallback(async () => {
        if (!analysisResult) return;
        setIsRefreshing(true);
        // In a real app, you'd re-fetch or re-process data. Here we just simulate a delay.
        await new Promise(resolve => setTimeout(resolve, 1500));
        // You could potentially add a new random record to simulate new data
        setIsRefreshing(false);
    }, [analysisResult]);
    
    const handleStartLive = useCallback(() => {
        setAppMode('live');
    }, []);

    const handleSessionEnd = useCallback((results: ProcessedVehicleData[]) => {
        setAnalysisResult(results);
        setAppMode(results.length > 0 ? 'dashboard' : 'upload');
    }, []);

    switch (appMode) {
        case 'loading':
            return <AnalysisProgressView steps={analysisSteps} />;
        case 'dashboard':
            return analysisResult && <DashboardView data={analysisResult} onGenerateReport={handleGenerateReport} onReset={handleReset} onRefreshData={handleRefreshData} isRefreshing={isRefreshing} />;
        case 'live':
            return <LiveAnalysisView onSessionEnd={handleSessionEnd} onReset={handleReset} />;
        case 'upload':
        default:
            return <UploadView onAnalyze={runAnalysis} isLoading={isLoading} parsingError={parsingError} onClearParsingError={() => setParsingError(null)} onStartLive={handleStartLive} />;
    }
}