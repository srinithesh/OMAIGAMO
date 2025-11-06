import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ProcessedVehicleData, ReportSections } from '../types';
import { CheckCircleIcon, WarningIcon, XCircleIcon, SparklesIcon, ProcessingIcon, ChevronDownIcon, CogIcon, SearchIcon, CarIcon, MotorcycleIcon, TruckIcon, QuestionMarkIcon, MoneyIcon, RefreshIcon, ChartBarIcon, UsersIcon, ShieldCheckIcon } from './Icons';
import { getComplianceSummary, getOverallSuggestions } from '../services/geminiService';
import AiFleetRecommendations from './AiFleetRecommendations';
import { Header } from './Header';

interface DashboardViewProps {
  data: ProcessedVehicleData[];
  onGenerateReport: (data: ProcessedVehicleData[], sections: ReportSections, summaries: Record<string, string>) => void;
  onReset: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
}

const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
        case 'active':
        case 'valid':
        case 'paid':
        case 'ok':
            return <CheckCircleIcon className="w-6 h-6 text-caribbean-green" />;
        case 'expired':
        case 'due':
            return <XCircleIcon className="w-6 h-6 text-frog" />;
        case 'suspicious':
        case 'potential station fault':
            return <WarningIcon className="w-6 h-6 text-yellow-400" />;
        default:
            return <span className="text-stone">-</span>;
    }
};

const formatDate = (dateString: string) => {
    if (!dateString) {
        return '—'; // Consistent placeholder for missing dates.
    }
    const date = new Date(dateString);
    // Check if the date is valid. An invalid date's getTime() returns NaN.
    if (isNaN(date.getTime())) {
        return dateString; // Return original string if it's not a valid date.
    }
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

type SortableKeys = 'plate' | 'vehicleType' | 'fine' | 'timestamp';


const ComplianceGauge: React.FC<{ score: number }> = ({ score }) => {
  const data = [{ name: 'score', value: score }];
  const color = score > 80 ? '#00DF81' : score > 50 ? '#20C295' : '#D9534F'; // Caribbean Green, Mountain Meadow, Red for severe
  
  return (
    <div className="relative w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
          barSize={20}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{fill: '#084533'}} dataKey="value" angleAxisId={0} cornerRadius={10}>
             <Cell fill={color} filter="url(#glow)" />
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold" style={{ color }}>
          {score.toFixed(0)}
        </span>
        <span className="text-lg text-stone">/ 100</span>
      </div>
      <svg width="0" height="0">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
};

const VehicleTypeIcon: React.FC<{ type: ProcessedVehicleData['vehicleType'] }> = ({ type }) => {
    const baseClass = "w-8 h-8";
    switch (type) {
        // FIX: Replaced `title` prop with a `<title>` child element for accessibility and to fix type errors.
        case '2-Wheeler':
            return <MotorcycleIcon className={`${baseClass} text-pistachio`}><title>2-Wheeler</title></MotorcycleIcon>;
        case '4-Wheeler':
            return <CarIcon className={`${baseClass} text-pistachio`}><title>4-Wheeler</title></CarIcon>;
        case 'Truck':
            return <TruckIcon className={`${baseClass} text-pistachio`}><title>Truck</title></TruckIcon>;
        default:
            return <QuestionMarkIcon className="w-7 h-7 text-stone"><title>Other</title></QuestionMarkIcon>;
    }
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; }> = ({ icon, label, value }) => (
    <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-4 border border-bangladesh-green flex items-center gap-4">
        <div className="p-3 bg-pine/50 rounded-md">
            {icon}
        </div>
        <div>
            <p className="text-stone text-sm">{label}</p>
            <p className="text-anti-flash-white text-2xl font-bold">{value}</p>
        </div>
    </div>
);


export const DashboardView: React.FC<DashboardViewProps> = ({ data, onGenerateReport, onReset, onRefreshData, isRefreshing }) => {
    const [summaries, setSummaries] = useState<Record<string, string>>({});
    const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({
        compliance: 'all',
        vehicleType: 'all',
        fueling: 'all'
    });
    const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
    const [reportOptions, setReportOptions] = useState<ReportSections>({
        includeComplianceDetails: true,
        includeFuelingDiscrepancies: true,
        includeDetailedInsights: false,
    });
    const [showReportOptions, setShowReportOptions] = useState(false);
    const [showReportConfirmationDialog, setShowReportConfirmationDialog] = useState(false);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [reviewedDiscrepancies, setReviewedDiscrepancies] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({ key: 'timestamp', direction: 'descending' });
    const [collectedBalances, setCollectedBalances] = useState<Set<string>>(new Set());
    const [expandedViolation, setExpandedViolation] = useState<string | null>(null);
    const [historyModalPlate, setHistoryModalPlate] = useState<string | null>(null);

    const vehicleHistory = useMemo(() => {
        if (!historyModalPlate) return null;
        return data
            .filter(d => d.plate === historyModalPlate)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [historyModalPlate, data]);

    const overallScore = data.reduce((acc, v) => acc + v.compliance.score, 0) / (data.length || 1);
    const totalPendingFines = data.reduce((acc, v) => acc + v.rto.pendingFine, 0);
    const discrepancyData = data.filter(v => v.fueling.discrepancyFlag !== 'OK');

    const violationSummary = useMemo(() => {
        const summary: Record<string, { count: number; plates: Set<string> }> = {};
    
        data.forEach(vehicle => {
            vehicle.compliance.overallStatus.forEach(status => {
                const violationType = status.split(' for ')[0].split(' on ')[0];
                
                if (!summary[violationType]) {
                    summary[violationType] = { count: 0, plates: new Set() };
                }
                summary[violationType].count++;
                summary[violationType].plates.add(vehicle.plate);
            });
        });
    
        return Object.entries(summary)
            .map(([type, data]) => ({ type, ...data }))
            .sort((a, b) => b.count - a.count);
    }, [data]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300); // 300ms delay for debouncing

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery]);

    const reviewedDiscrepancyCount = useMemo(() => {
        return discrepancyData.filter(v => reviewedDiscrepancies.has(v.plate)).length;
    }, [discrepancyData, reviewedDiscrepancies]);

    const microBalanceData = useMemo(() => {
        const balances: Record<string, { total: number; count: number; lastSeen: string }> = {};

        data.forEach(v => {
            if (v.fueling.microBalance > 0.001) { // Ignore tiny floating point errors
                if (!balances[v.plate]) {
                    balances[v.plate] = { total: 0, count: 0, lastSeen: v.timestamp };
                }
                balances[v.plate].total += v.fueling.microBalance;
                balances[v.plate].count += 1;
                if (new Date(v.timestamp) > new Date(balances[v.plate].lastSeen)) {
                    balances[v.plate].lastSeen = v.timestamp;
                }
            }
        });

        return Object.entries(balances)
            .map(([plate, info]) => ({
                plate,
                ...info,
            }))
            .filter(item => !collectedBalances.has(item.plate) && item.total > 0.01)
            .sort((a, b) => b.total - a.total); // Sort by highest balance first

    }, [data, collectedBalances]);

    const vehicleTypes = useMemo(() => ['all', ...Array.from(new Set(data.map(v => v.vehicleType)))], [data]);

    const filteredData = useMemo(() => {
        // Prepare date range filters once to avoid reparsing in the loop
        const startDate = dateRange.start ? new Date(dateRange.start) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);
        const endDate = dateRange.end ? new Date(dateRange.end) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);
    
        const processedData = data.filter(v => {
            // Apply cheaper filters first to reduce the dataset for more expensive checks.
    
            // Search filter (debounced)
            const searchLower = debouncedSearchQuery.toLowerCase();
            if (searchLower && !v.plate.toLowerCase().includes(searchLower)) {
                return false;
            }
    
            // Compliance status filter
            if (filters.compliance === 'violations' && v.compliance.overallStatus.length === 0) return false;
            if (filters.compliance === 'compliant' && v.compliance.overallStatus.length > 0) return false;
    
            // Vehicle type filter
            if (filters.vehicleType !== 'all' && v.vehicleType !== filters.vehicleType) return false;
    
            // Fueling discrepancy filter
            if (filters.fueling !== 'all' && v.fueling.discrepancyFlag !== filters.fueling) return false;
    
            // Date range filter
            if (startDate || endDate) {
                const vehicleDate = new Date(v.timestamp);
                if (isNaN(vehicleDate.getTime())) return false; // Exclude items with invalid dates
                if (startDate && vehicleDate < startDate) return false;
                if (endDate && vehicleDate > endDate) return false;
            }
    
            return true;
        });
    
        // Apply sorting (sorts in-place, but on a new array from .filter())
        if (sortConfig !== null) {
            processedData.sort((a, b) => {
                const { key, direction } = sortConfig;
                let aVal, bVal;
                
                switch (key) {
                    case 'plate':
                        aVal = a.plate;
                        bVal = b.plate;
                        return direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    case 'vehicleType':
                        aVal = a.vehicleType;
                        bVal = b.vehicleType;
                        return direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    case 'fine':
                        aVal = a.rto.pendingFine;
                        bVal = b.rto.pendingFine;
                        break;
                    case 'timestamp':
                        aVal = new Date(a.timestamp).getTime();
                        bVal = new Date(b.timestamp).getTime();
                        break;
                    default:
                        return 0;
                }
    
                if (aVal < bVal) {
                    return direction === 'ascending' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
    
        return processedData;
    }, [data, filters, dateRange, debouncedSearchQuery, sortConfig]);

    const isDateFilterActive = dateRange.start || dateRange.end;

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({
            compliance: 'all',
            vehicleType: 'all',
            fueling: 'all'
        });
        setDateRange({ start: '', end: '' });
        setSearchQuery('');
        setSortConfig({ key: 'timestamp', direction: 'descending' });
    };
    
    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleGenerateSummary = async (vehicleData: ProcessedVehicleData) => {
        if (loadingSummary === vehicleData.plate || summaries[vehicleData.plate]) return;
        setLoadingSummary(vehicleData.plate);
        try {
            const summary = await getComplianceSummary(vehicleData);
            setSummaries(prev => ({ ...prev, [vehicleData.plate]: summary }));
        } catch (error) {
            console.error("Failed to get AI summary:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setSummaries(prev => ({ ...prev, [vehicleData.plate]: message }));
        } finally {
            setLoadingSummary(null);
        }
    };

    const handleGenerateSuggestions = async () => {
        setIsGeneratingSuggestions(true);
        setSuggestionsError(null);
        setAiSuggestions(null);
        try {
            const suggestions = await getOverallSuggestions(data);
            setAiSuggestions(suggestions);
        } catch (error) {
            console.error("Failed to get AI suggestions:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setSuggestionsError(message);
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const toggleReviewedStatus = (plate: string) => {
        setReviewedDiscrepancies(prev => {
            const newSet = new Set(prev);
            if (newSet.has(plate)) {
                newSet.delete(plate);
            } else {
                newSet.add(plate);
            }
            return newSet;
        });
    };
    
    const handleCollectBalance = (plate: string) => {
        setCollectedBalances(prev => new Set(prev).add(plate));
    };

    const allVisibleSelected = useMemo(() => {
        return filteredData.length > 0 && filteredData.every(v => selectedRows.has(v.plate));
    }, [filteredData, selectedRows]);

    const handleSelectAll = () => {
        const newSelection = new Set(selectedRows);
        if (allVisibleSelected) {
            filteredData.forEach(v => newSelection.delete(v.plate));
        } else {
            filteredData.forEach(v => newSelection.add(v.plate));
        }
        setSelectedRows(newSelection);
    };

    const handleRowSelect = (plate: string) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(plate)) {
            newSelection.delete(plate);
        } else {
            newSelection.add(plate);
        }
        setSelectedRows(newSelection);
    };

    const handleReportOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setReportOptions(prev => ({ ...prev, [name]: checked }));
    };
    
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReportClick = () => {
        setShowReportConfirmationDialog(true);
    };

    const handleConfirmAndGenerate = () => {
        const dataToReport = selectedRows.size > 0
            ? data.filter(v => selectedRows.has(v.plate))
            // eslint-disable-next-line indent
            : filteredData;
        
        if (dataToReport.length > 0) {
            onGenerateReport(dataToReport, reportOptions, summaries);
        }
        setShowReportConfirmationDialog(false);
    };


    const handleMarkAllReviewed = () => {
        const platesToReview = discrepancyData.map(v => v.plate);
        setReviewedDiscrepancies(new Set([...reviewedDiscrepancies, ...platesToReview]));
    };

    const handleClearReviews = () => {
        setReviewedDiscrepancies(new Set());
    };

    const reportButtonText = selectedRows.size > 0
        ? `Generate Report for ${selectedRows.size} Vehicle(s)`
        // eslint-disable-next-line indent
        : 'Generate Filtered Report';
    
    const isReportButtonDisabled = (selectedRows.size === 0 && filteredData.length === 0) || 
                                     (!reportOptions.includeComplianceDetails && !reportOptions.includeFuelingDiscrepancies && !reportOptions.includeDetailedInsights);


    const DetailRow: React.FC<{ vehicle: ProcessedVehicleData }> = ({ vehicle }) => {
        return (
            <div className="p-4 bg-pine/50 space-y-4 animate-fade-in">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Card 1: RTO & Compliance */}
                    <div className="flex-1 bg-basil/20 p-4 rounded-lg border border-bangladesh-green/50">
                        <h4 className="font-bold text-caribbean-green mb-3 border-b border-bangladesh-green/30 pb-2">RTO & Compliance</h4>
                        <div className="space-y-2 text-sm">
                            <p><span className="font-semibold text-stone w-28 inline-block">Owner:</span> {vehicle.rto.owner}</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">Registration:</span> {vehicle.compliance.registrationStatus} (til {formatDate(vehicle.rto.registrationValidTill)})</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">PUC:</span> {vehicle.compliance.pucStatus} (til {formatDate(vehicle.rto.pollutionValidTill)})</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">Insurance:</span> {vehicle.compliance.insuranceStatus}</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">Road Tax:</span> {vehicle.compliance.taxStatus}</p>
                            <p className="flex items-start">
                                <span className="font-semibold text-stone w-28 inline-block flex-shrink-0">Pending Fine:</span>
                                {vehicle.rto.pendingFine > 0 ? (
                                    <span className="flex-grow">
                                        {`₹${vehicle.rto.pendingFine} (${vehicle.rto.fineReason})`}
                                    </span>
                                ) : <span className="flex-grow">None</span>}
                            </p>
                        </div>
                    </div>

                    {/* Card 2: Fueling Analysis */}
                    <div className="flex-1 bg-basil/20 p-4 rounded-lg border border-bangladesh-green/50">
                        <h4 className="font-bold text-caribbean-green mb-3 border-b border-bangladesh-green/30 pb-2">Fueling Analysis</h4>
                        <div className="space-y-2 text-sm">
                           <p><span className="font-semibold text-stone w-32 inline-block">Status:</span> {vehicle.fueling.discrepancyFlag}</p>
                            <p><span className="font-semibold text-stone w-32 inline-block">Billed Fuel:</span> {vehicle.fueling.billed.toFixed(2)} L</p>
                            <p><span className="font-semibold text-stone w-32 inline-block">Detected Fuel:</span> {vehicle.fueling.detected.toFixed(2)} L</p>
                            <p><span className="font-semibold text-stone w-32 inline-block">Discrepancy:</span> <span className={Math.abs(vehicle.fueling.difference) > 0.1 ? 'text-red-400 font-bold' : ''}>{vehicle.fueling.difference.toFixed(2)} L</span></p>
                        </div>
                    </div>
                </div>
                
                {/* Card 3: AI Insights */}
                <div className="bg-basil/20 p-4 rounded-lg border border-bangladesh-green/50">
                    <h4 className="font-bold text-caribbean-green mb-3">AI Insights</h4>
                    <div>
                        {summaries[vehicle.plate] ? (
                            <div className="text-sm text-anti-flash-white/90 whitespace-pre-wrap font-mono bg-rich-black/30 p-3 rounded-md">{summaries[vehicle.plate]}</div>
                        ) : (
                            <button
                                onClick={() => handleGenerateSummary(vehicle)}
                                disabled={!!loadingSummary}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40 disabled:opacity-50 disabled:cursor-wait transition-all"
                            >
                                {loadingSummary === vehicle.plate ? (
                                    <ProcessingIcon className="w-4 h-4 animate-spin" />
                                ) : (
                                    <SparklesIcon className="w-4 h-4" />
                                )}
                                {loadingSummary === vehicle.plate ? 'Generating...' : 'Generate AI Summary'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
    <div className="p-4 md:p-8 min-h-screen animate-fade-in">
        <Header onReset={onReset} onRefreshData={onRefreshData} isRefreshing={isRefreshing} />

        {/* Fleet Overview Stat Cards */}
        <div className="mb-6 animate-slide-in-up">
            <h2 className="text-xl font-semibold text-anti-flash-white mb-4">Fleet Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<UsersIcon className="w-8 h-8 text-caribbean-green" />} label="Vehicles Analyzed" value={data.length} />
                <StatCard icon={<ShieldCheckIcon className="w-8 h-8 text-caribbean-green" />} label="Fleet Compliance Score" value={overallScore.toFixed(1)} />
                <StatCard icon={<MoneyIcon className="w-8 h-8 text-caribbean-green" />} label="Total Pending Fines" value={`₹${totalPendingFines.toLocaleString('en-IN')}`} />
                <StatCard icon={<WarningIcon className="w-8 h-8 text-caribbean-green" />} label="Active Fueling Alerts" value={discrepancyData.length} />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Left Panel */}
            <div className="lg:col-span-2 xl:col-span-3 space-y-6">
                 {/* Unified Compliance Table */}
                 <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-4 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '100ms'}}>
                    <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-anti-flash-white">Unified Compliance Table</h2>
                        <div className="text-sm font-semibold text-stone bg-pine/50 px-3 py-1 rounded-md border border-bangladesh-green/50">
                            {`Displaying ${filteredData.length} of ${data.length} vehicles`}
                        </div>
                    </div>

                    {/* FILTERS */}
                    <div className="flex flex-col md:flex-row flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-bangladesh-green/50">
                        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
                            {/* Search Bar */}
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <SearchIcon className="w-5 h-5 text-stone" />
                                </span>
                                <input
                                    type="text"
                                    id="search-plate"
                                    placeholder="Search by Plate..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-basil/80 border border-bangladesh-green rounded-md pl-10 pr-3 py-1.5 w-full sm:w-48 text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none transition-all"
                                    aria-label="Search by license plate"
                                />
                            </div>
                            
                            {/* Dropdown Filters */}
                            <div className="flex items-center gap-2">
                                <label htmlFor="compliance-filter" className="text-stone font-semibold text-sm">Status:</label>
                                <select
                                    id="compliance-filter"
                                    name="compliance"
                                    value={filters.compliance}
                                    onChange={handleFilterChange}
                                    className="bg-basil/50 border border-bangladesh-green rounded-md px-3 py-1.5 text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none transition-all"
                                >
                                    <option value="all">All</option>
                                    <option value="violations">With Violations</option>
                                    <option value="compliant">Compliant</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="vehicle-type-filter" className="text-stone font-semibold text-sm">Vehicle:</label>
                                <select
                                    id="vehicle-type-filter"
                                    name="vehicleType"
                                    value={filters.vehicleType}
                                    onChange={handleFilterChange}
                                    className="bg-basil/50 border border-bangladesh-green rounded-md px-3 py-1.5 text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none transition-all"
                                >
                                    {vehicleTypes.map(type => (
                                        <option key={type} value={type}>{type === 'all' ? 'All Types' : type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="fueling-filter" className="text-stone font-semibold text-sm">Fueling:</label>
                                <select
                                    id="fueling-filter"
                                    name="fueling"
                                    value={filters.fueling}
                                    onChange={handleFilterChange}
                                    className="bg-basil/50 border border-bangladesh-green rounded-md px-3 py-1.5 text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none transition-all"
                                >
                                    <option value="all">All</option>
                                    <option value="OK">OK</option>
                                    <option value="Suspicious">Suspicious</option>
                                    <option value="Potential Station Fault">Station Fault</option>
                                </select>
                            </div>
                             {/* Date Filters */}
                            <div className="flex items-center gap-2">
                                <label htmlFor="start-date" className="text-stone font-semibold text-sm">Date:</label>
                                <input 
                                   type="date"
                                   id="start-date"
                                   name="start"
                                   value={dateRange.start}
                                   onChange={handleDateChange}
                                   className="bg-basil/80 border border-bangladesh-green rounded-md px-2 py-1.5 w-full text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none"
                                   aria-label="Start Date"
                                />
                                <span className="text-stone">-</span>
                                <input 
                                   type="date"
                                   id="end-date"
                                   name="end"
                                   value={dateRange.end}
                                   onChange={handleDateChange}
                                   className="bg-basil/80 border border-bangladesh-green rounded-md px-2 py-1.5 w-full text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none"
                                   aria-label="End Date"
                                />
                            </div>
                        </div>

                        <button
                            onClick={resetFilters}
                            className="text-sm text-stone hover:text-caribbean-green transition-colors font-semibold"
                        >
                            Reset Filters
                        </button>
                    </div>


                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-bangladesh-green text-stone">
                                <tr>
                                    <th className="p-3 w-12 text-center">
                                         <input
                                            type="checkbox"
                                            className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                            checked={allVisibleSelected}
                                            onChange={handleSelectAll}
                                            disabled={filteredData.length === 0}
                                            aria-label="Select all visible vehicles"
                                        />
                                    </th>
                                    <th className="p-3 w-8"></th>
                                    {['Plate', 'Date', 'Vehicle', 'Helmet', 'Fine', 'Insurance', 'PUC', 'Tax', 'Fueling', 'Status'].map(h => {
                                        const sortableColumns: Partial<Record<string, SortableKeys>> = {
                                            'Plate': 'plate',
                                            'Date': 'timestamp',
                                            'Vehicle': 'vehicleType',
                                            'Fine': 'fine',
                                        };
                                        const sortKey = sortableColumns[h];

                                        if (sortKey) {
                                            return (
                                                <th key={h} className="p-3 cursor-pointer select-none group" onClick={() => requestSort(sortKey)}>
                                                    <div className="flex items-center gap-1 hover:text-anti-flash-white transition-colors">
                                                        {h}
                                                        {sortConfig?.key === sortKey ? (
                                                            <ChevronDownIcon className={`w-4 h-4 text-caribbean-green transition-transform transform ${sortConfig.direction === 'ascending' ? 'rotate-180' : ''}`} />
                                                        ) : (
                                                            <ChevronDownIcon className="w-4 h-4 text-transparent group-hover:text-stone/50" />
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        }
                                        return <th key={h} className="p-3">{h}</th>;
                                    })}
                                    <th className="p-3 text-center">History</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length > 0 ? (
                                    filteredData.map((v) => (
                                        <React.Fragment key={`${v.plate}-${v.timestamp}`}>
                                            <tr 
                                                className="border-b border-bangladesh-green/50 hover:bg-forest transition-colors group"
                                            >
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer"
                                                        checked={selectedRows.has(v.plate)}
                                                        onChange={() => handleRowSelect(v.plate)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        aria-label={`Select vehicle ${v.plate}`}
                                                    />
                                                </td>
                                                <td 
                                                    className="p-3 text-center cursor-pointer"
                                                    onClick={() => setExpandedRow(expandedRow === `${v.plate}-${v.timestamp}` ? null : `${v.plate}-${v.timestamp}`)}
                                                >
                                                    <ChevronDownIcon className={`w-5 h-5 text-stone transition-transform transform group-hover:text-anti-flash-white ${expandedRow === `${v.plate}-${v.timestamp}` ? 'rotate-180' : ''}`} />
                                                </td>
                                                <td className="p-3 font-mono">{v.plate}</td>
                                                <td className="p-3 text-stone">{formatDate(v.timestamp)}</td>
                                                <td className="p-3">
                                                    <VehicleTypeIcon type={v.vehicleType} />
                                                </td>
                                                <td className="p-3">{v.helmet === null ? '—' : (v.helmet ? <CheckCircleIcon className="w-6 h-6 text-caribbean-green" /> : <XCircleIcon className="w-6 h-6 text-red-500" />)}</td>
                                                <td className="p-3">{v.rto.pendingFine > 0 ? `₹${v.rto.pendingFine}` : '₹0'}</td>
                                                <td className="p-3">{getStatusIcon(v.compliance.insuranceStatus)}</td>
                                                <td className="p-3">{getStatusIcon(v.compliance.pucStatus)}</td>
                                                <td className="p-3">{getStatusIcon(v.compliance.taxStatus)}</td>
                                                <td className="p-3">
                                                    {v.fueling.discrepancyFlag !== 'OK' && reviewedDiscrepancies.has(v.plate)
                                                        ? <span title="Discrepancy Reviewed"><CheckCircleIcon className="w-6 h-6 text-pistachio" /></span>
                                                        : getStatusIcon(v.fueling.discrepancyFlag)}
                                                </td>
                                                <td className="p-3 text-frog">{v.compliance.overallStatus.length > 0 ? v.compliance.overallStatus[0].split(' on ')[0] : <span className="text-caribbean-green">OK</span>}</td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => setHistoryModalPlate(v.plate)}
                                                        className="p-1 rounded-full hover:bg-forest transition-colors"
                                                        aria-label={`View history for ${v.plate}`}
                                                        title={`View history for ${v.plate}`}
                                                    >
                                                        <ChartBarIcon className="w-6 h-6 text-stone group-hover:text-caribbean-green" />
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedRow === `${v.plate}-${v.timestamp}` && (
                                                <tr className="bg-pine/30">
                                                    <td colSpan={13} className="p-0">
                                                        <DetailRow vehicle={v} />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={13} className="text-center p-8 text-stone">
                                            {isDateFilterActive
                                                ? "No vehicles found for the selected date range and filters."
                                                : "No vehicles match the current filters."
                                            }
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Fueling Discrepancy Summary */}
                {discrepancyData.length > 0 && (
                    <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-4 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '200ms'}}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-anti-flash-white">
                                Fueling Discrepancy Detections ({discrepancyData.length} total, {reviewedDiscrepancyCount} reviewed)
                            </h2>
                             <div className="flex gap-2">
                                <button
                                    onClick={handleMarkAllReviewed}
                                    disabled={discrepancyData.every(v => reviewedDiscrepancies.has(v.plate))}
                                    className="text-xs px-3 py-1 rounded bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Mark All as Reviewed
                                </button>
                                <button
                                    onClick={handleClearReviews}
                                    disabled={reviewedDiscrepancies.size === 0}
                                    className="text-xs px-3 py-1 rounded bg-stone/20 text-stone hover:bg-stone/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Clear Reviews
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b-2 border-bangladesh-green text-stone">
                                    <tr>
                                        {['Plate', 'Billed (L)', 'Detected (L)', 'Difference (L)', 'Flag', 'Action'].map(h => (
                                            <th key={h} className="p-3">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {discrepancyData.map((v, i) => (
                                        <tr key={i} className={`border-b border-bangladesh-green/50 hover:bg-frog/30 transition-all ${reviewedDiscrepancies.has(v.plate) ? 'bg-forest/30 opacity-60' : 'bg-frog/20'}`}>
                                            <td className="p-3 font-mono">{v.plate}</td>
                                            <td className="p-3">{v.fueling.billed.toFixed(2)}</td>
                                            <td className="p-3">{v.fueling.detected.toFixed(2)}</td>
                                            <td className={`p-3 font-bold text-red-400`}>{v.fueling.difference.toFixed(2)}</td>
                                            <td className="p-3 text-yellow-400 flex items-center gap-2"><WarningIcon className="w-5 h-5" />{v.fueling.discrepancyFlag}</td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => toggleReviewedStatus(v.plate)}
                                                    className={`text-xs px-3 py-1 rounded transition-all whitespace-nowrap ${
                                                        reviewedDiscrepancies.has(v.plate) 
                                                        ? 'bg-stone/20 text-stone hover:bg-stone/40' 
                                                        : 'bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40'
                                                    }`}
                                                >
                                                    {reviewedDiscrepancies.has(v.plate) ? 'Undo' : 'Mark as Reviewed'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                {/* Micro Balance Recovery */}
                {microBalanceData.length > 0 && (
                    <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-4 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '300ms'}}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-anti-flash-white flex items-center gap-2">
                                <MoneyIcon className="w-6 h-6 text-caribbean-green" />
                                Micro Balance Recovery
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b-2 border-bangladesh-green text-stone">
                                    <tr>
                                        {['Plate', 'Pending Amount', 'Transactions', 'Last Seen', 'Action'].map(h => (
                                            <th key={h} className="p-3">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {microBalanceData.map((v) => {
                                        const isHighBalance = v.total >= 10;
                                        return (
                                            <tr 
                                                key={v.plate} 
                                                className={`border-b border-bangladesh-green/50 hover:bg-forest transition-all ${isHighBalance ? 'bg-pine border-l-4 border-caribbean-green animate-border-glow-pulse' : ''}`}
                                            >
                                                <td className="p-3 font-mono">{v.plate}</td>
                                                <td className={`p-3 font-bold ${isHighBalance ? 'text-caribbean-green text-lg' : 'text-anti-flash-white'}`}>
                                                    ₹{v.total.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-stone">{v.count}</td>
                                                <td className="p-3 text-stone">{formatDate(v.lastSeen)}</td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => handleCollectBalance(v.plate)}
                                                        className="text-xs px-3 py-1 rounded transition-all whitespace-nowrap bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40"
                                                    >
                                                        Mark as Collected
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {/* Right Panel */}
            <div className="lg:col-span-1 xl:col-span-1 space-y-6">
                <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-6 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '200ms'}}>
                    <h2 className="text-xl font-semibold text-anti-flash-white mb-4 text-center">Overall Compliance Score</h2>
                    <ComplianceGauge score={overallScore} />
                </div>
                <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-6 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '300ms'}}>
                    <h2 className="text-xl font-semibold text-anti-flash-white mb-4">Violations Summary</h2>
                    {violationSummary.length > 0 ? (
                        <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-2">
                            {violationSummary.map(({ type, count, plates }) => (
                                <div key={type} className="bg-pine/50 rounded-lg transition-all duration-300">
                                    <div 
                                        className="flex justify-between items-center cursor-pointer p-3"
                                        onClick={() => setExpandedViolation(expandedViolation === type ? null : type)}
                                        aria-expanded={expandedViolation === type}
                                        aria-controls={`violation-details-${type.replace(/\s+/g, '-')}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <WarningIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                                            <span className="font-semibold text-anti-flash-white">{type}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-caribbean-green text-rich-black text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
                                            <ChevronDownIcon className={`w-5 h-5 text-stone transition-transform ${expandedViolation === type ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                    {expandedViolation === type && (
                                        <div 
                                            id={`violation-details-${type.replace(/\s+/g, '-')}`}
                                            className="pt-0 p-3 pl-11 text-sm text-stone animate-fade-in"
                                        >
                                            <p className="font-semibold mb-1 text-anti-flash-white/80 border-b border-bangladesh-green/50 pb-1">Affected Vehicles:</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 font-mono pt-2">
                                                {Array.from(plates).map(plate => (
                                                    <span key={plate}>{plate}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <CheckCircleIcon className="w-12 h-12 text-caribbean-green mx-auto mb-2" />
                            <p className="text-anti-flash-white">No violations detected.</p>
                        </div>
                    )}
                </div>
                 <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-6 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '400ms'}}>
                    <h2 className="text-xl font-semibold text-anti-flash-white mb-4">AI Fleet Recommendations</h2>
                    {isGeneratingSuggestions ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <ProcessingIcon className="w-12 h-12 text-caribbean-green animate-spin" />
                            <p className="text-stone mt-2">Analyzing fleet data...</p>
                        </div>
                    ) : suggestionsError ? (
                        <div className="text-center py-4">
                            <p className="text-red-500 mb-4">{suggestionsError}</p>
                            <button
                                onClick={handleGenerateSuggestions}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-md font-semibold rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-all"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                Retry
                            </button>
                        </div>
                    ) : aiSuggestions !== null ? (
                        <>
                            <AiFleetRecommendations suggestions={aiSuggestions} />
                             <button
                                onClick={handleGenerateSuggestions}
                                disabled={isGeneratingSuggestions}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-md font-semibold rounded-md bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40 disabled:opacity-50 transition-all mt-4"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                Regenerate Suggestions
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-stone mb-4">Get AI-powered insights for your fleet.</p>
                            <button
                                onClick={handleGenerateSuggestions}
                                disabled={isGeneratingSuggestions}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-md font-semibold rounded-md bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40 transition-all"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                Generate Fleet Suggestions
                            </button>
                        </div>
                    )}
                </div>
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <button 
                            onClick={handleGenerateReportClick} 
                            disabled={isReportButtonDisabled}
                            className="flex-grow text-lg font-bold bg-caribbean-green text-rich-black px-4 py-3 rounded-md hover:bg-mountain-meadow hover:shadow-glow-green-lg transition-all duration-300 disabled:bg-stone disabled:cursor-not-allowed"
                        >
                            {reportButtonText}
                        </button>
                        <button
                            onClick={() => setShowReportOptions(!showReportOptions)}
                            className="flex-shrink-0 p-3 bg-basil rounded-md text-caribbean-green hover:bg-forest hover:shadow-glow-green transition-all"
                            aria-label="Customize Report"
                        >
                            <CogIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {showReportOptions && (
                        <div className="bg-basil/50 p-4 rounded-lg border border-bangladesh-green animate-fade-in text-sm space-y-3">
                             <h4 className="font-semibold text-anti-flash-white mb-2">Report Options</h4>
                             <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        name="includeComplianceDetails"
                                        checked={reportOptions.includeComplianceDetails} 
                                        onChange={handleReportOptionChange}
                                        className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer" 
                                    />
                                    Compliance Details Table
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        name="includeFuelingDiscrepancies"
                                        checked={reportOptions.includeFuelingDiscrepancies} 
                                        onChange={handleReportOptionChange}
                                        className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer" 
                                    />
                                    Fueling Discrepancy Analysis
                                 </label>
                                 <label className="flex items-center gap-3 cursor-pointer relative">
                                    <input 
                                        type="checkbox" 
                                        name="includeDetailedInsights"
                                        checked={reportOptions.includeDetailedInsights} 
                                        onChange={handleReportOptionChange}
                                        className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer" 
                                    />
                                    Detailed Vehicle Insights (AI & RTO)
                                    <span className="ml-2 bg-caribbean-green text-rich-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">PRO</span>
                                 </label>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {showReportConfirmationDialog && (
            <div className="fixed inset-0 bg-rich-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                <div className="bg-basil/90 border border-bangladesh-green rounded-lg shadow-glow-green-lg p-6 w-full max-w-lg m-4 animate-slide-in-up">
                    <h3 className="text-2xl font-bold text-caribbean-green mb-4">Confirm Report Generation</h3>
                    <div className="text-anti-flash-white/90 space-y-3 mb-6">
                        <p>You are about to generate a report with the following parameters:</p>
                        <div className="bg-pine/50 p-4 rounded-md border border-bangladesh-green/50">
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong>Vehicles to Include:</strong> {selectedRows.size > 0 ? `${selectedRows.size} selected vehicle(s)` : `${filteredData.length} filtered vehicle(s)`}
                                </li>
                                <li>
                                    <strong>Report Sections:</strong>
                                    <ul className="list-disc list-inside pl-6 mt-1">
                                        {reportOptions.includeComplianceDetails && <li>Compliance Details Table</li>}
                                        {reportOptions.includeFuelingDiscrepancies && <li>Fueling Discrepancy Analysis</li>}
                                        {reportOptions.includeDetailedInsights && <li>Detailed Vehicle Insights (AI & RTO)</li>}
                                        {!reportOptions.includeComplianceDetails && !reportOptions.includeFuelingDiscrepancies && !reportOptions.includeDetailedInsights && <li className="text-stone">No sections selected</li>}
                                    </ul>
                                </li>
                            </ul>
                        </div>
                        <p>Do you want to proceed?</p>
                    </div>
                    <div className="flex justify-end gap-4">
                        <button
                            onClick={() => setShowReportConfirmationDialog(false)}
                            className="px-6 py-2 rounded-md bg-stone/20 text-stone hover:bg-stone/40 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmAndGenerate}
                            className="px-6 py-2 rounded-md bg-caribbean-green text-rich-black font-bold hover:bg-mountain-meadow hover:shadow-glow-green transition-all"
                        >
                            Confirm & Generate
                        </button>
                    </div>
                </div>
            </div>
        )}

        {vehicleHistory && historyModalPlate && (
             <div className="fixed inset-0 bg-rich-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                <div className="bg-basil/95 border border-bangladesh-green rounded-lg shadow-glow-green-lg p-6 w-full max-w-4xl m-4 animate-slide-in-up flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold text-caribbean-green">Compliance History for <span className="font-mono">{historyModalPlate}</span></h3>
                        <button onClick={() => setHistoryModalPlate(null)} className="text-stone hover:text-anti-flash-white">
                            <XCircleIcon className="w-8 h-8"/>
                        </button>
                    </div>
                    
                    {/* Trend Graph */}
                    <div className="w-full h-72 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={vehicleHistory}
                                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#09624C" />
                                <XAxis dataKey="timestamp" tickFormatter={(ts) => formatDate(ts)} stroke="#707D7D" />
                                <YAxis domain={[0, 100]} stroke="#707D7D"/>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(13, 15, 17, 0.9)',
                                        borderColor: '#09624C',
                                        color: '#F1F7F5'
                                    }}
                                    labelFormatter={(label) => formatDate(label)}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="compliance.score" name="Compliance Score" stroke="#00DF81" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    
                    {/* Violation Log */}
                    <div className="flex-grow overflow-y-auto pr-2">
                        <h4 className="text-xl font-semibold text-anti-flash-white mb-3">Transaction Log</h4>
                        <div className="space-y-4">
                            {vehicleHistory.map((entry) => (
                                <div key={entry.timestamp} className="bg-pine/50 p-3 rounded-md border-l-4 border-bangladesh-green">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-semibold text-stone">{formatDate(entry.timestamp)}</p>
                                        <p className="font-bold text-lg" style={{ color: entry.compliance.score > 80 ? '#00DF81' : entry.compliance.score > 50 ? '#20C295' : '#D9534F' }}>
                                            Score: {entry.compliance.score}
                                        </p>
                                    </div>
                                    {entry.compliance.overallStatus.length > 0 ? (
                                        <ul className="list-disc list-inside text-sm text-anti-flash-white/80 space-y-1">
                                            {entry.compliance.overallStatus.map((status, index) => (
                                                <li key={index}>{status.replace(` on ${entry.plate}`, '').replace(` for ${entry.plate}`, '')}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-caribbean-green">No violations recorded for this transaction.</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
    );
};