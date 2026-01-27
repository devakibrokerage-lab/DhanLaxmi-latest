/**
 * OptionLimitManager.js
 * Handles the logic for Daily 10% Option Limit (Intraday vs Overnight)
 */

export const checkOptionLimit = (fund, product, requiredMargin) => {
    // 1. Determine Product Type (Intraday vs Overnight)
    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    // 'MIS' and 'CO' or others treated as Intraday
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    // 2. Initialize if missing
    if (!fund.option_limit) fund.option_limit = {};
    if (!fund.option_limit[typeKey]) {
        fund.option_limit[typeKey] = { used_today: 0, last_trade_date: new Date() };
    }

    const limitTracker = fund.option_limit[typeKey];

    // 3. Date Check (Reset if new day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastDate = limitTracker.last_trade_date ? new Date(limitTracker.last_trade_date) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);

    if (!lastDate || lastDate.getTime() !== today.getTime()) {
        limitTracker.used_today = 0;
        limitTracker.last_trade_date = new Date();
    }

    // 4. Calculate Maximum Allowed Cap (Dynamic % of RELEVANT Available Limit)
    let baseLimit = 0;
    if (isOvernight) {
        // For NRML, base is Overnight Available Limit
        baseLimit = fund.overnight ? fund.overnight.available_limit : 0;
    } else {
        // For MIS/Intraday, base is Intraday Available Limit
        baseLimit = fund.intraday ? fund.intraday.available_limit : 0;
    }

    // Use stored percentage or default to 10
    const limitPercent = fund.option_limit_percentage !== undefined ? Number(fund.option_limit_percentage) : 10;
    
    // Convert % to decimal (e.g., 10 => 0.10)
    const dailyCap = (baseLimit || 0) * (limitPercent / 100);
    const currentUsed = limitTracker.used_today || 0;

    // 5. Check Constraint
    if ((currentUsed + requiredMargin) > dailyCap) {
        const limitPercent = fund.option_limit_percentage !== undefined ? Number(fund.option_limit_percentage) : 10;
        return {
            allowed: false,
            message: `Daily ${isOvernight ? 'Overnight' : 'Intraday'} Option Limit Exceeded (${limitPercent}% Cap). Max: ${dailyCap.toFixed(3)}, Used Today: ${currentUsed.toFixed(2)}, Required: ${requiredMargin.toFixed(3)}`
        };
    }

    return { allowed: true };
};

export const updateOptionUsage = (fund, product, amount) => {
    if (amount <= 0) return;

    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    if (!fund.option_limit) fund.option_limit = {};
    if (!fund.option_limit[typeKey]) {
        fund.option_limit[typeKey] = { used_today: 0, last_trade_date: new Date() };
    }

    const limitTracker = fund.option_limit[typeKey];
    
    // Just add to usage
    limitTracker.used_today = (limitTracker.used_today || 0) + Number(amount);
    limitTracker.last_trade_date = new Date();
    
    // Force Mongoose to recognize the change
    if(fund.markModified) {
        fund.markModified('option_limit');
    }
    
    console.log(`[OptionLimit] Updated ${typeKey}: +${amount}, Total: ${limitTracker.used_today}`);
};

export const rollbackOptionUsage = (fund, product, amount) => {
    if (amount <= 0) return;

    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    if (fund.option_limit && fund.option_limit[typeKey]) {
        const limitTracker = fund.option_limit[typeKey];
        limitTracker.used_today = (limitTracker.used_today || 0) - Number(amount);
        if (limitTracker.used_today < 0) limitTracker.used_today = 0;
        
        if(fund.markModified) {
            fund.markModified('option_limit');
        }
        console.log(`[OptionLimit] Rollback ${typeKey}: -${amount}, Total: ${limitTracker.used_today}`);
    }
};
