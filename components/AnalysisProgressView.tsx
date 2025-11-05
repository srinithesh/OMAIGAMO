import React from 'react';
import { AnalysisStep } from '../types';
import { CheckCircleIcon, ProcessingIcon, CircleIcon } from './Icons';

interface AnalysisProgressViewProps {
  steps: AnalysisStep[];
}

const getStatusIcon = (status: AnalysisStep['status']) => {
    switch (status) {
        case 'pending':
            return <CircleIcon className="w-6 h-6 text-stone" />;
        case 'in-progress':
            return <ProcessingIcon className="w-6 h-6 text-caribbean-green animate-spin" />;
        case 'complete':
            return <CheckCircleIcon className="w-6 h-6 text-caribbean-green" />;
    }
};


export const AnalysisProgressView: React.FC<AnalysisProgressViewProps> = ({ steps }) => {
    return (
        <div className="fixed inset-0 bg-rich-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-fade-in">
            <div className="w-full max-w-2xl text-center p-4">
                <h2 className="text-3xl md:text-4xl font-bold text-caribbean-green mb-4 tracking-wider shadow-glow-green animate-pulse-slow">
                    AI ANALYSIS IN PROGRESS
                </h2>
                <p className="text-lg text-anti-flash-white/80 mb-10">
                    Processing vehicle data through our compliance matrix...
                </p>
                <div className="space-y-4 text-left">
                    {steps.map((step, index) => (
                        <div key={index} className="bg-pine/50 border border-bangladesh-green/50 rounded-lg p-4 flex items-center gap-4 animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
                            <div className="flex-shrink-0">
                                {getStatusIcon(step.status)}
                            </div>
                            <div className="flex-grow">
                                <p className={`text-lg font-semibold transition-colors ${step.status === 'pending' ? 'text-stone' : 'text-anti-flash-white'}`}>
                                    {step.title}
                                </p>
                                {step.status === 'in-progress' && typeof step.progress === 'number' && step.progress > 0 && (
                                    <div className="w-full bg-basil rounded-full h-2.5 mt-2">
                                        <div 
                                            className="bg-caribbean-green h-2.5 rounded-full transition-all duration-500" 
                                            style={{ width: `${step.progress}%` }}
                                        ></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};