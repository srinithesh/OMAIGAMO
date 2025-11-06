import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProcessedVehicleData } from '../types';
import { PlayIcon, StopIcon, XCircleIcon, CheckCircleIcon, ProcessingIcon } from './Icons';
import { Header } from './Header';
import { analyzeLiveFrame } from '../services/apiService';


export const LiveAnalysisView: React.FC<{
  onSessionEnd: (results: ProcessedVehicleData[]) => void;
  onReset: () => void;
}> = ({ onSessionEnd, onReset }) => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [detectedVehicles, setDetectedVehicles] = useState<ProcessedVehicleData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
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

    const captureAndAnalyzeFrame = useCallback(async () => {
        if (isAnalyzing || !videoRef.current || !canvasRef.current) return;

        setIsAnalyzing(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            
            try {
                const result = await analyzeLiveFrame(frameData);
                if (result) {
                     setDetectedVehicles(prev => [result, ...prev].slice(0, 50)); // Keep the list from growing indefinitely
                }
            } catch (err) {
                console.error("Error analyzing frame:", err);
                // Optionally show a temporary error to the user
            }
        }
        setIsAnalyzing(false);
    }, [isAnalyzing]);

    const startStreaming = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsStreaming(true);
        intervalRef.current = setInterval(captureAndAnalyzeFrame, 2000); // Analyze every 2 seconds
    };

    const stopStreaming = () => {
        setIsStreaming(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const handleFinishSession = () => {
        stopStreaming();
        cleanupCamera();
        onSessionEnd(detectedVehicles);
    };
    
    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8 animate-fade-in bg-rich-black">
            <Header onReset={onReset} isLive />
            <canvas ref={canvasRef} className="hidden"></canvas>

            {error ? (
                 <div className="flex-grow flex items-center justify-center">
                    <div className="bg-pine/50 border border-red-500/50 rounded-lg p-8 text-center max-w-2xl">
                        <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-anti-flash-white mb-2">Camera Error</h2>
                        <p className="text-stone">{error}</p>
                        <button
                            onClick={onReset}
                            className="mt-6 text-lg font-bold bg-caribbean-green text-rich-black px-8 py-3 rounded-md hover:bg-mountain-meadow hover:shadow-glow-green-lg transition-all duration-300"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-basil/30 border border-bangladesh-green rounded-lg p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                             <h2 className="text-xl font-semibold text-anti-flash-white">Live CCTV Feed</h2>
                             <div className="flex items-center gap-4">
                                <button
                                    onClick={isStreaming ? stopStreaming : startStreaming}
                                    className={`flex items-center gap-2 px-6 py-2 rounded-md font-bold text-lg transition-all ${
                                        isStreaming 
                                        ? 'bg-red-500/80 text-white hover:bg-red-600' 
                                        : 'bg-caribbean-green text-rich-black hover:bg-mountain-meadow'
                                    }`}
                                >
                                    {isStreaming ? <StopIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                                    {isStreaming ? 'PAUSE' : 'START'}
                                </button>
                                <button 
                                    onClick={handleFinishSession} 
                                    className="border border-stone text-stone px-6 py-2 rounded-md hover:border-caribbean-green hover:text-caribbean-green hover:shadow-glow-green transition-all duration-300 font-bold"
                                >
                                    Finish Session
                                </button>
                             </div>
                        </div>
                        <div className="relative flex-grow w-full bg-rich-black rounded-md overflow-hidden aspect-video">
                           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                           {isStreaming && (
                                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-bold animate-pulse">
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                    LIVE
                                </div>
                           )}
                           {isAnalyzing && (
                                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-caribbean-green/20 text-caribbean-green px-3 py-1 rounded-md text-sm font-bold">
                                    <ProcessingIcon className="w-4 h-4 animate-spin" />
                                    ANALYZING...
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