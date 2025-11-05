import React, { useState, useRef, useEffect } from 'react';
import { Logo } from './Logo';
import { BuildingOfficeIcon, ChevronUpDownIcon, UserCircleIcon, RefreshIcon, ProcessingIcon, LogoutIcon } from './Icons';

interface HeaderProps {
    onReset: () => void;
    onRefreshData?: () => void;
    isRefreshing?: boolean;
    isLive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onReset, onRefreshData, isRefreshing, isLive }) => {
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const workspaces = ['North Zone Fleet', 'West Zone Fleet', 'National Logistics'];
    const [currentWorkspace, setCurrentWorkspace] = useState(workspaces[0]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
                setWorkspaceOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    const handleWorkspaceChange = (ws: string) => {
        setCurrentWorkspace(ws);
        setWorkspaceOpen(false);
        onReset(); // Simulate loading a new workspace
    };

    return (
        <header className="flex flex-wrap gap-4 justify-between items-center mb-6 pb-6 border-b border-bangladesh-green/50">
            <div className="flex items-center gap-4">
                <Logo className="w-12 h-12" />
                <div>
                    <h1 className="text-2xl font-bold text-caribbean-green tracking-wider">VERIDIAN FLEET</h1>
                    {isLive && <p className="text-sm font-semibold text-red-500 animate-pulse">LIVE MONITORING ACTIVE</p>}
                </div>
            </div>
            <div className="flex items-center gap-4">
                {/* Workspace Switcher */}
                <div className="relative" ref={workspaceRef}>
                    <button onClick={() => setWorkspaceOpen(!workspaceOpen)} className="flex items-center gap-3 bg-basil/50 border border-bangladesh-green rounded-md px-4 py-2 text-anti-flash-white hover:border-caribbean-green transition-colors">
                        <BuildingOfficeIcon className="w-5 h-5 text-stone" />
                        <span className="font-semibold">{currentWorkspace}</span>
                        <ChevronUpDownIcon className="w-5 h-5 text-stone" />
                    </button>
                    {workspaceOpen && (
                        <div className="absolute top-full mt-2 w-64 bg-basil border border-bangladesh-green rounded-lg shadow-lg z-20 animate-fade-in">
                            {workspaces.map(ws => (
                                <a key={ws} href="#" onClick={(e) => { e.preventDefault(); handleWorkspaceChange(ws); }} className="block px-4 py-2 text-anti-flash-white hover:bg-forest transition-colors">
                                    {ws}
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                {!isLive && onRefreshData && (
                    <button
                        onClick={onRefreshData}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 border border-stone text-stone px-4 py-2 rounded-md hover:border-caribbean-green hover:text-caribbean-green hover:shadow-glow-green transition-all duration-300 disabled:opacity-50 disabled:cursor-wait"
                        title="Fetch latest data"
                    >
                        {isRefreshing ? <ProcessingIcon className="w-5 h-5 animate-spin" /> : <RefreshIcon className="w-5 h-5" />}
                        {isRefreshing ? 'Fetching...' : 'Refresh'}
                    </button>
                )}
                 {!isLive && (
                    <button 
                        onClick={onReset} 
                        className="border border-stone text-stone px-4 py-2 rounded-md hover:border-caribbean-green hover:text-caribbean-green hover:shadow-glow-green transition-all duration-300"
                    >
                        New Analysis
                    </button>
                 )}

                {/* User Profile */}
                <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="p-2 rounded-full hover:bg-basil/50 transition-colors">
                        <UserCircleIcon className="w-8 h-8 text-pistachio" />
                    </button>
                    {userMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-basil border border-bangladesh-green rounded-lg shadow-lg z-20 animate-fade-in">
                           <div className="p-4 border-b border-bangladesh-green/50">
                                <p className="font-semibold text-anti-flash-white">John Doe</p>
                                <p className="text-sm text-stone">john.doe@veridian.io</p>
                                <span className="mt-2 inline-block bg-caribbean-green text-rich-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">PRO PLAN</span>
                           </div>
                           <div className="p-2">
                            <a href="#" onClick={(e) => {e.preventDefault(); onReset();}} className="flex items-center gap-3 w-full px-4 py-2 text-left text-anti-flash-white hover:bg-forest rounded-md transition-colors">
                                <LogoutIcon className="w-5 h-5" />
                                Logout
                            </a>
                           </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
