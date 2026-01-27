// src/page/Funds/FundHelpers.jsx

export const formatCurrency = (value) => {
  const num = Number(value);
  if (value === null || value === undefined || isNaN(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const FundMetric = ({ label, value, icon: Icon, valueColorClass = "text-[var(--text-primary)]" }) => (
  <div className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-b-0">
    <div className="flex items-center text-[var(--text-secondary)]">
      {Icon && <Icon className="w-5 h-5 mr-3 text-indigo-400" />}
      <span className="font-medium text-sm">{label}</span>
    </div>
    <span className={`font-bold text-base ${valueColorClass}`}>
      {formatCurrency(value)}
    </span>
  </div>
);
