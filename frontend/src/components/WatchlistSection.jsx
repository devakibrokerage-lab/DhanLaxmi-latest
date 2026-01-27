import React from "react";
import clsx from "clsx";

const WatchlistSection = ({ sectionStocks }) => {
  // Helper for tinted chip background
  const getChipBg = (value) => {
    if (value > 0) return "bg-[var(--gain-chip-bg)]";
    if (value < 0) return "bg-[var(--loss-chip-bg)]";
    return "bg-transparent";
  };
  // Helper for text color
  const getPnlTextColor = (value) => {
    if (value > 0) return "text-[var(--gain-text)]";
    if (value < 0) return "text-[var(--loss-text)]";
    return "text-[var(--text-primary)]";
  };
  const getArrow = (value) => {
    if (value > 0) return "▲";
    if (value < 0) return "▼";
    return "";
  };

  return (
    <div className="mb-6">
<div className="max-h-[500px] overflow-y-auto border border-[var(--border-color)] rounded-lg">
        <table className="min-w-full divide-y divide-[var(--border-color)]">
          <thead className="bg-[var(--bg-secondary)] sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Symbol</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Exchange</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">LTP</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Net Change</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">% Change</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Volume</th>
            </tr>
          </thead>
          <tbody className="bg-[var(--bg-card)] divide-y divide-[var(--border-color)]">
            {sectionStocks.map((stock, idx) => (
              <tr key={idx} className="hover:bg-[var(--bg-hover)] transition-colors duration-200">
                <td className="px-4 py-2 font-semibold text-[var(--text-primary)]">{stock.symbol}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{stock.exchange}</td>
                <td className="px-4 py-2 text-[var(--text-primary)]">{stock.ltp !== undefined ? stock.ltp : '-'}</td>
                <td className="px-4 py-2">
                  <span className={clsx("px-1.5 py-0.5 rounded", getChipBg(stock.netChange), getPnlTextColor(stock.netChange))}>
                    {getArrow(stock.netChange)} {stock.netChange !== undefined ? stock.netChange.toFixed(2) : '-'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={clsx("px-1.5 py-0.5 rounded", getChipBg(stock.percentChange), getPnlTextColor(stock.percentChange))}>
                    {getArrow(stock.percentChange)} {stock.percentChange !== undefined ? stock.percentChange.toFixed(2) + '%' : '-'}
                  </span>
                </td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{stock.volume !== undefined ? stock.volume.toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WatchlistSection;
