import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AiDetection, ProcessedVehicleData, RtoData, Transaction } from '../types';
import { mockAiDetections, mockRtoDatabase } from '../services/mockData';
import { PlayIcon, StopIcon, XCircleIcon, CheckCircleIcon } from './Icons';

interface LiveAnalysisViewProps {
  onSessionEnd: (results: ProcessedVehicleData[]) => void;
}

const processSingleVehicle = (tx: Transaction, detection: AiDetection, rto: RtoData): ProcessedVehicleData => {
    let score = 100;
    const overallStatus: string[] = [];
    
    const isRegValid = new Date(rto.registrationValidTill || 0) > new Date();
    const isPucValid = new Date(rto.pollutionValidTill || 0) > new Date();
    
    if (!isRegValid) { score -= 20; overallStatus.push(`Reg Expired`); }
    if (rto.insuranceStatus !== 'Active') { score -= 20; overallStatus.push(`Insurance Expired`); }
    if (!isPucValid) { score -= 20; overallStatus.push(`PUC Expired`); }
    if (rto.pendingFine > 0) { score -= 20; overallStatus.push(`Fine Pending: ₹${rto.pendingFine}`); }
    if (rto.roadTaxStatus !== 'Paid') { score -= 20; overallStatus.push(`Tax Due`); }
    if (detection.vehicleType === '2-Wheeler' && detection.helmet === false) {
        score -= 15;
        overallStatus.push(`No Helmet`);
    }

    return {
        plate: tx.plate,
        vehicleType: detection.vehicleType || 'Other',
        helmet: detection.helmet === undefined ? null : detection.helmet,
        timestamp: tx.timestamp,
        rto,
        amount: tx.amount,
        fueling: { // Simplified for live view
            billed: 0,
            detected: 0,
            difference: 0,
            discrepancyFlag: 'OK',
            microBalance: 0,
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
};

export const LiveAnalysisView: React.FC<LiveAnalysisViewProps> = ({ onSessionEnd }) => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [detectedVehicles, setDetectedVehicles] = useState<ProcessedVehicleData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    // FIX: Use `number` for interval ID in browser environments instead of `NodeJS.Timeout`.
    const intervalRef = useRef<number | null>(null);
    
    const cleanupCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        const setupCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                streamRef.current = stream;
            } catch (err) {
                console.error("Error accessing camera:", err);
                setError("Camera access was denied. Please enable camera permissions in your browser settings to use this feature.");
            }
        };

        setupCamera();
        
        return () => {
            cleanupCamera();
        };
    }, [cleanupCamera]);

    const startSimulation = () => {
        setIsStreaming(true);
        intervalRef.current = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * mockAiDetections.length);
            const detection = mockAiDetections[randomIndex];
            const rto = mockRtoDatabase[detection.plate];
            
            if (detection && rto) {
                const transaction: Transaction = {
                    plate: detection.plate,
                    timestamp: new Date().toISOString(),
                    amount: 0,
                    billedLiters: 0,
                    stationId: 'LIVE-01'
                };
                const processed = processSingleVehicle(transaction, detection, rto);
                setDetectedVehicles(prev => [processed, ...prev]);
            }
        }, 3000); // New detection every 3 seconds
    };

    const stopSimulation = () => {
        setIsStreaming(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };

    const handleFinishSession = () => {
        stopSimulation();
        cleanupCamera();
        onSessionEnd(detectedVehicles);
    };
    
    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8 animate-fade-in bg-rich-black">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-caribbean-green tracking-wider">LIVE COMPLIANCE MONITORING</h1>
                <button 
                    onClick={handleFinishSession} 
                    className="border border-stone text-stone px-6 py-2 rounded-md hover:border-caribbean-green hover:text-caribbean-green hover:shadow-glow-green transition-all duration-300 font-bold"
                >
                    Finish Session & View Report
                </button>
            </header>

            {error ? (
                 <div className="flex-grow flex items-center justify-center">
                    <div className="bg-pine/50 border border-red-500/50 rounded-lg p-8 text-center max-w-2xl">
                        <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-anti-flash-white mb-2">Camera Error</h2>
                        <p className="text-stone">{error}</p>
                    </div>
                </div>
            ) : (
                <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-basil/30 border border-bangladesh-green rounded-lg p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                             <h2 className="text-xl font-semibold text-anti-flash-white">Live CCTV Feed</h2>
                             <button
                                onClick={isStreaming ? stopSimulation : startSimulation}
                                className={`flex items-center gap-2 px-6 py-2 rounded-md font-bold text-lg transition-all ${
                                    isStreaming 
                                    ? 'bg-red-500/80 text-white hover:bg-red-600' 
                                    : 'bg-caribbean-green text-rich-black hover:bg-mountain-meadow'
                                }`}
                            >
                                {isStreaming ? <StopIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                                {isStreaming ? 'PAUSE ANALYSIS' : 'START ANALYSIS'}
                            </button>
                        </div>
                        <div className="relative flex-grow w-full bg-rich-black rounded-md overflow-hidden aspect-video">
                           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                           {isStreaming && (
                                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-bold animate-pulse">
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                    LIVE
                                </div>
                           )}
                        </div>
                    </div>
                    <div className="lg:col-span-1 bg-basil/30 border border-bangladesh-green rounded-lg p-4 flex flex-col">
                        <h2 className="text-xl font-semibold text-anti-flash-white mb-4 flex-shrink-0">Real-time Detection Log</h2>
                        <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                           {detectedVehicles.length === 0 && (
                                <div className="text-center text-stone pt-16">
                                    <p>{isStreaming ? 'Waiting for vehicle detection...' : 'Start analysis to see live results.'}</p>
                                </div>
                           )}
                            {detectedVehicles.map((v) => (
                                <div key={v.timestamp} className="bg-pine/50 p-3 rounded-md border-l-4 border-bangladesh-green animate-slide-in-up">
                                    <div className="flex justify-between items-center">
                                        <p className="font-mono font-bold text-lg text-anti-flash-white">{v.plate}</p>
                                        <p className="text-xs text-stone">{new Date(v.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                    <div className="mt-2 text-sm">
                                        {v.compliance.overallStatus.length > 0 ? (
                                            v.compliance.overallStatus.map((status, i) => (
                                                <div key={i} className="flex items-center gap-2 text-red-400">
                                                   <XCircleIcon className="w-4 h-4 flex-shrink-0" />
                                                   <span>{status}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex items-center gap-2 text-caribbean-green">
                                               <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                                               <span>All Systems Nominal</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};