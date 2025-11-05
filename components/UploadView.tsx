import React, { useState, useRef } from 'react';
import { UploadIcon, CameraIcon, BoltIcon, PlayIcon, XCircleIcon } from './Icons';
import { getMockTransactionCsv } from '../services/mockData';
import { Logo } from './Logo';

interface UploadViewProps {
  onAnalyze: (videoFile: File, transactionLog: string, yoloModelFile: File) => void;
  isLoading: boolean;
  parsingError: string | null;
  onClearParsingError: () => void;
  onStartLive: () => void;
}

export const UploadView: React.FC<UploadViewProps> = ({ onAnalyze, isLoading, parsingError, onClearParsingError, onStartLive }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transactionLog, setTransactionLog] = useState<string>('');
  const [yoloModelFile, setYoloModelFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string>('');

  const videoInputRef = useRef<HTMLInputElement>(null);
  const transactionInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const clearAllErrors = () => {
    setValidationError('');
    if (parsingError) {
      onClearParsingError();
    }
  };

  const handleModelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setYoloModelFile(e.target.files[0]);
      clearAllErrors();
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      clearAllErrors();
    }
  };

  const handleTransactionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTransactionLog(event.target?.result as string);
        clearAllErrors();
      };
      reader.readAsText(e.target.files[0]);
    }
  };
  
  const handleUseMockVideo = () => {
    const mockVideoFile = new File(["mock video content"], "cctv_feed.mp4", { type: "video/mp4" });
    setVideoFile(mockVideoFile);
    clearAllErrors();
  };

  const handleUseMockTransactions = () => {
    const mockCsv = getMockTransactionCsv();
    setTransactionLog(mockCsv);
    clearAllErrors();
  };


  const handleAnalyzeClick = () => {
    if (!yoloModelFile || !videoFile || !transactionLog) {
      setValidationError('Please provide a model file, CCTV feed, and transaction log.');
      return;
    }
    clearAllErrors();
    onAnalyze(videoFile, transactionLog, yoloModelFile);
  };

  const displayError = parsingError || validationError;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-5xl text-center">
        <div className="flex justify-center items-center gap-4 mb-4">
            <Logo className="w-16 h-16"/>
            <h1 className="text-4xl md:text-6xl font-bold text-caribbean-green tracking-wider inline-block pb-2 shadow-glow-green">VERIDIAN FLEET</h1>
        </div>
        <p className="text-lg text-anti-flash-white/80 mb-12">Select analysis mode: Batch Processing or Live Monitoring</p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Batch File Analysis */}
          <div className="bg-pine/50 border-2 border-bangladesh-green rounded-lg p-8 flex flex-col items-center justify-between transition-all duration-300 hover:border-caribbean-green hover:shadow-glow-green transform hover:-translate-y-1">
            <div>
              <BoltIcon className="w-16 h-16 text-caribbean-green mb-4 mx-auto" />
              <h2 className="text-2xl font-semibold mb-2 text-anti-flash-white">Batch File Analysis</h2>
              <p className="text-stone mb-6">Process pre-recorded video and transaction logs.</p>
            </div>
            
            <div className="w-full space-y-4">
                {/* YOLO Model Upload */}
               <div className="bg-rich-black/30 border-2 border-dashed border-bangladesh-green/70 rounded-md p-4 w-full text-left">
                  <p className="font-semibold text-anti-flash-white/90">1. YOLO V9 Model</p>
                  <p className="text-sm text-stone mb-3 truncate">{yoloModelFile ? yoloModelFile.name : 'Select a .pt or .weights model file.'}</p>
                  <div className="flex gap-2">
                      <button onClick={() => modelInputRef.current?.click()} className="flex-1 text-sm font-bold bg-frog text-rich-black px-4 py-2 rounded-md hover:bg-mountain-meadow transition-all">
                          Select Model
                      </button>
                      <input type="file" ref={modelInputRef} onChange={handleModelFileChange} accept=".pt,.weights" className="hidden" />
                  </div>
               </div>

               {/* Video Upload */}
               <div className="bg-rich-black/30 border-2 border-dashed border-bangladesh-green/70 rounded-md p-4 w-full text-left">
                  <p className="font-semibold text-anti-flash-white/90">2. CCTV Feed</p>
                  <p className="text-sm text-stone mb-3 truncate">{videoFile ? videoFile.name : 'Select an .mp4 video file for analysis.'}</p>
                  <div className="flex gap-2">
                      <button onClick={() => videoInputRef.current?.click()} className="flex-1 text-sm font-bold bg-frog text-rich-black px-4 py-2 rounded-md hover:bg-mountain-meadow transition-all">
                          Select Video
                      </button>
                      <button onClick={handleUseMockVideo} className="flex-1 text-sm font-bold bg-transparent border-2 border-frog text-frog px-4 py-2 rounded-md hover:bg-frog hover:text-rich-black transition-all">
                          Use Mock Video
                      </button>
                      <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/mp4" className="hidden" />
                  </div>
               </div>

               {/* Transaction Log Upload */}
               <div className="bg-rich-black/30 border-2 border-dashed border-bangladesh-green/70 rounded-md p-4 w-full text-left">
                  <p className="font-semibold text-anti-flash-white/90">3. Transaction Log</p>
                  <p className="text-sm text-stone mb-3">{transactionLog ? 'Log file loaded.' : 'Select a .csv transaction log.'}</p>
                   <div className="flex gap-2">
                      <button onClick={() => transactionInputRef.current?.click()} className="flex-1 text-sm font-bold bg-frog text-rich-black px-4 py-2 rounded-md hover:bg-mountain-meadow transition-all">
                          Select Log
                      </button>
                      <button onClick={handleUseMockTransactions} className="flex-1 text-sm font-bold bg-transparent border-2 border-frog text-frog px-4 py-2 rounded-md hover:bg-frog hover:text-rich-black transition-all">
                          Use Mock Log
                      </button>
                      <input type="file" ref={transactionInputRef} onChange={handleTransactionChange} accept=".csv,.json" className="hidden" />
                  </div>
               </div>
            </div>

            <div className="w-full mt-6">
                {displayError && (
                    <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative mb-4 flex items-start gap-4 animate-fade-in text-left" role="alert">
                        <XCircleIcon className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
                        <div className="flex-grow">
                            <strong className="font-bold text-red-200">Analysis Failed</strong>
                            <p className="text-sm mt-1">{displayError}</p>
                        </div>
                        <button onClick={clearAllErrors} className="p-1 rounded-full hover:bg-red-700/50 transition-colors" aria-label="Dismiss error">
                            <XCircleIcon className="w-5 h-5 text-red-400/70 hover:text-red-300" />
                        </button>
                    </div>
                )}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      onClick={handleAnalyzeClick}
                      disabled={isLoading || !yoloModelFile || !videoFile || !transactionLog}
                      className="w-full text-lg font-bold bg-caribbean-green text-rich-black px-8 py-3 rounded-md hover:bg-mountain-meadow hover:shadow-glow-green-lg transition-all duration-300 disabled:bg-stone disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      <UploadIcon className="w-6 h-6" />
                      {isLoading ? 'ANALYZING...' : 'START ANALYSIS'}
                    </button>
                </div>
            </div>
          </div>

          {/* Live Stream Monitoring */}
          <div className="bg-pine/50 border-2 border-bangladesh-green rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all duration-300 hover:border-caribbean-green hover:shadow-glow-green transform hover:-translate-y-1 relative">
            <span className="absolute top-4 right-4 bg-caribbean-green text-rich-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">PRO</span>
            <CameraIcon className="w-16 h-16 text-caribbean-green mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-anti-flash-white">Live Stream Monitoring</h2>
            <p className="text-stone mb-8">Analyze a live feed directly from your webcam for real-time compliance checks.</p>
            <button
                onClick={onStartLive}
                disabled={isLoading}
                className="text-lg font-bold bg-caribbean-green text-rich-black px-12 py-4 rounded-md hover:bg-mountain-meadow hover:shadow-glow-green-lg transition-all duration-300 disabled:bg-stone disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <PlayIcon className="w-6 h-6" />
                START LIVE FEED
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};