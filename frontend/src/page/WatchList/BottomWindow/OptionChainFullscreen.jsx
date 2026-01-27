import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, AlertCircle, Loader, TrendingDown, ChevronDown } from 'lucide-react';
import { useOptionChain } from '../../../hooks/useOptionChain';
import OptionStrikeBottomWindow from './OptionStrikeBottomWindow';
import StockChart from '../../Chart/StockChart';

// Strike count options
const STRIKE_OPTIONS = [
    { label: '6 Strikes', value: 6 },
    { label: '12 Strikes', value: 12 },

];

// Auto-refresh interval (in ms) - 5 seconds for near real-time feel
const AUTO_REFRESH_INTERVAL = 5000;

const OptionChainFullscreen = ({ selectedStock, sheetData, onClose }) => {
    // Tab State: 'Charts' | 'OptionChain'
    const [activeTab, setActiveTab] = useState('Charts');
    const [selectedExpiry, setSelectedExpiry] = useState(null);
    const [strikeCount, setStrikeCount] = useState(12);
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    const [selectedStrike, setSelectedStrike] = useState(null);

    // Option Chain Data Hook
    const {
        chainData,
        spotPrice,
        expiries,
        loading,
        error,
        refetch
    } = useOptionChain({
        name: selectedStock?.name,
        segment: selectedStock?.segment,
        expiry: selectedExpiry
    });

    // Check if options are available (simple check: if we have expiries or chainData)
    // We can also check segment usually (NFO/MCX), but this hook data is a good proxy.
    // If loading, we assume it might be available to avoid flickering.
    const hasOptions = useMemo(() => {
        if (selectedStock?.segment === 'NFO' || selectedStock?.segment === 'MCX') return true;
        return (expiries && expiries.length > 0) || (chainData && chainData.length > 0);
    }, [selectedStock, expiries, chainData]);

    // Handle ESC key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Auto-refresh (only when Option Chain tab is active)
    useEffect(() => {
        if (activeTab !== 'OptionChain') return;

        const interval = setInterval(() => {
            refetch();
            setLastUpdateTime(new Date());
        }, AUTO_REFRESH_INTERVAL);

        setLastUpdateTime(new Date());
        return () => clearInterval(interval);
    }, [refetch, activeTab]);

    // Update timestamp when data changes
    useEffect(() => {
        if (chainData) setLastUpdateTime(new Date());
    }, [chainData]);

    const currentPrice = spotPrice || sheetData?.ltp || 0;

    // Filter Logic for Option Chain (Only calculate if tab is active)
    const { filteredChain, atmStrike } = useMemo(() => {
        if (activeTab !== 'OptionChain' || !chainData || chainData.length === 0 || !currentPrice) {
            return { filteredChain: [], atmStrike: null };
        }

        // ... (Existing ATM Finding Logic) ...
        let closestStrike = chainData[0]?.strike;
        let minDiff = Math.abs(chainData[0]?.strike - currentPrice);

        chainData.forEach(row => {
            const diff = Math.abs(row.strike - currentPrice);
            if (diff < minDiff) {
                minDiff = diff;
                closestStrike = row.strike;
            }
        });

        const atmIndex = chainData.findIndex(row => row.strike === closestStrike);
        const strikesPerSide = Math.floor((strikeCount - 1) / 2);
        let strikesAbove = strikesPerSide;
        let strikesBelow = strikesPerSide;

        const availableAbove = atmIndex;
        const availableBelow = chainData.length - atmIndex - 1;

        if (availableAbove < strikesAbove) {
            strikesAbove = availableAbove;
            strikesBelow = Math.min(availableBelow, strikeCount - strikesAbove - 1);
        }
        if (availableBelow < strikesBelow) {
            strikesBelow = availableBelow;
            strikesAbove = Math.min(availableAbove, strikeCount - strikesBelow - 1);
        }

        const startIndex = Math.max(0, atmIndex - strikesAbove);
        const endIndex = Math.min(chainData.length, atmIndex + strikesBelow + 1);

        return {
            filteredChain: chainData.slice(startIndex, endIndex),
            atmStrike: closestStrike
        };
    }, [chainData, currentPrice, strikeCount, activeTab]);

    const formatExpiry = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatLTP = (value) => {
        if (value === undefined || value === null) return '—';
        return Number(value).toFixed(2);
    };

    // --- Renderers ---

    const renderHeader = () => (
        <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] px-2 pt-2 pb-0 flex-shrink-0 flex flex-col gap-2">

            {/* Top Row: Close Button Only (Title moved to Tabs or unnecessary) */}
            <div className="flex items-center justify-between">
                {/* Tabs */}
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('Charts')}
                        className={`text-sm font-semibold pb-2 border-b-2 transition ${activeTab === 'Charts' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Charts
                    </button>
                    {hasOptions && (
                        <button
                            onClick={() => setActiveTab('OptionChain')}
                            className={`text-sm font-semibold pb-2 border-b-2 transition ${activeTab === 'OptionChain' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            Option Chain
                        </button>
                    )}
                </div>

                {/* Window Controls */}
                <div className="flex items-center gap-1 mb-1">
                    {activeTab === 'OptionChain' && (
                        <button
                            onClick={() => { refetch(); setLastUpdateTime(new Date()); }}
                            className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                    )}
                    {/* Close button (X) handled by parent usually, but good to have here too */}
                    {/* <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition"
                        title="Close"
                    >
                        <X className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button> */}
                </div>
            </div>

            {/* Option Chain Filters - Only show if Option Chain tab is active */}
            {activeTab === 'OptionChain' && (
                <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[var(--text-muted)] text-xs">Spot:</span>
                        <span className="text-yellow-400 text-sm font-bold">₹{Number(currentPrice).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={strikeCount}
                            onChange={(e) => setStrikeCount(Number(e.target.value))}
                            className="bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-1 rounded border border-[var(--border-color)] text-xs"
                        >
                            {STRIKE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        {expiries && expiries.length > 0 && (
                            <select
                                value={selectedExpiry || expiries[0]}
                                onChange={(e) => setSelectedExpiry(e.target.value)}
                                className="bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-1 rounded border border-[var(--border-color)] text-xs max-w-[100px]"
                            >
                                {expiries.map(exp => <option key={exp} value={exp}>{formatExpiry(exp)}</option>)}
                            </select>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderChart = () => (
        <div className="flex-1 w-full h-full bg-[var(--bg-primary)] overflow-hidden">
            {/* We simply mount StockChart here. It handles its own data fetching. */}
            {/* We assume selectedStock has instrument_token. */}
            {selectedStock?.instrument_token ? (
                <StockChart
                    instrument_token={selectedStock.instrument_token}
                    tradingSymbol={selectedStock.tradingSymbol || selectedStock.name}
                // Optional: pass initial headers if needed
                />
            ) : (
                <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
                    No Instrument Token for Chart
                </div>
            )}
        </div>
    );

    const renderOptionChainBody = () => {
        if (loading && !chainData) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <Loader className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                    <p className="text-red-400 text-sm mb-4">{error}</p>
                    <button onClick={refetch} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm">Retry</button>
                </div>
            );
        }
        if (!filteredChain || filteredChain.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-[var(--text-secondary)]">
                    <p>No Option Data</p>
                </div>
            );
        }

        return (
            <div className="flex-1 overflow-y-auto p-2 flex flex-col items-center justify-center">
                <div className="w-full max-w-3xl bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-xs font-semibold py-2">
                        <div className="text-center text-green-400">Call LTP</div>
                        <div className="text-center text-[var(--text-secondary)] border-x border-[var(--border-color)]">Strike</div>
                        <div className="text-center text-red-400">Put LTP</div>
                    </div>
                    {/* Body */}
                    <div>
                        {filteredChain.map(row => {
                            const isATM = row.strike === atmStrike;
                            return (
                                <div key={row.strike} className={`grid grid-cols-3 border-b border-[var(--border-color)] last:border-b-0 text-sm ${isATM ? 'bg-yellow-500/10' : ''}`}>
                                    <div
                                        className={`p-2 text-center cursor-pointer hover:bg-green-500/10 ${row.call?.ltp ? 'text-green-400' : 'text-[var(--text-muted)]'}`}
                                        onClick={() => row.call?.instrument_token && setSelectedStrike({ strike: row.strike, type: 'CE', instrumentToken: row.call.instrument_token, expiry: selectedExpiry || expiries?.[0] })}
                                    >
                                        {formatLTP(row.call?.ltp)}
                                    </div>
                                    <div className={`p-2 text-center font-medium border-x border-[var(--border-color)] ${isATM ? 'text-yellow-400' : 'text-[var(--text-primary)]'}`}>
                                        {row.strike}
                                    </div>
                                    <div
                                        className={`p-2 text-center cursor-pointer hover:bg-red-500/10 ${row.put?.ltp ? 'text-red-400' : 'text-[var(--text-muted)]'}`}
                                        onClick={() => row.put?.instrument_token && setSelectedStrike({ strike: row.strike, type: 'PE', instrumentToken: row.put.instrument_token, expiry: selectedExpiry || expiries?.[0] })}
                                    >
                                        {formatLTP(row.put?.ltp)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
            {renderHeader()}

            {activeTab === 'Charts' ? renderChart() : renderOptionChainBody()}


            <OptionStrikeBottomWindow
                isOpen={selectedStrike !== null}
                onClose={() => setSelectedStrike(null)}
                optionType={selectedStrike?.type}
                strikePrice={selectedStrike?.strike}
                instrumentToken={selectedStrike?.instrumentToken}
                underlyingStock={selectedStock}
                spotPrice={currentPrice}
                expiry={selectedStrike?.expiry}
            />
        </div>
    );
};

export default OptionChainFullscreen;
