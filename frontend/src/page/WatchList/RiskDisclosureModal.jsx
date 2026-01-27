import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const RiskDisclosureModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isChecked, setIsChecked] = useState(false);

    useEffect(() => {
        // 1. Check User Role
        const userString = localStorage.getItem('loggedInUser');
        if (!userString) return;

        try {
            const user = JSON.parse(userString);
            // Show only for 'customer' (or assume everyone if not broker/admin, but user said "only for customer")
            // Let's strictly check for NOT broker/admin if roles are strictly defined, or just checking if role is 'User' or 'customer'. 
            // Based on previous files, role seems to be 'broker' or 'user' (customer).
            // Let's assume 'user' or implicit customer. 
            // Safest: If role is 'broker' or 'admin', do not show.
            if (user.role === 'broker' || user.role === 'admin') return;

            // 2. Check 24h Logic
            const lastAckKey = `riskDisclosureAck_${user.id || user._id || 'guest'}`;
            const lastAckTime = localStorage.getItem(lastAckKey);

            const now = new Date().getTime();
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (!lastAckTime || (now - parseInt(lastAckTime)) > twentyFourHours) {
                setIsOpen(true);
            }
        } catch (e) {
            console.error("Error checking user for Risk Modal", e);
        }
    }, []);

    const handleAgree = () => {
        if (!isChecked) return;

        // Save current time
        const userString = localStorage.getItem('loggedInUser');
        if (userString) {
            const user = JSON.parse(userString);
            const lastAckKey = `riskDisclosureAck_${user.id || user._id || 'guest'}`;
            localStorage.setItem(lastAckKey, new Date().getTime().toString());
        }

        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--bg-card)] w-[90%] max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-[var(--border-color)]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-orange-500 fill-orange-500/10" />
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Acknowledgment</h2>
                    </div>
                    {/* Optional Close Button - User requirement says "Agreement dikhana he", usually these are mandatory. 
              But screenshot has an 'X'. I will make it close ONLY if checked or maybe just close properly. 
              Actually, for forced agreement, X usually just closes modal but might reappear on refresh. 
              Let's allow close but not set the 24h flag (so it appears again next time). */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <p className="text-[var(--text-primary)] text-sm leading-relaxed mb-6 font-medium text-center">
                        CFDs are complex and risky products. Trading on margin is highly risky – you can lose all of the funds you invest. Make sure you understand these risks and that CFDs are suitable for you before trading.
                    </p>

                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 mb-6">
                        <div className="flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <p className="text-orange-800 text-xs font-semibold leading-relaxed">
                                Important: Please read and understand this risk disclosure before proceeding with CFD trading.
                            </p>
                        </div>
                    </div>

                    {/* Checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={isChecked}
                                onChange={(e) => setIsChecked(e.target.checked)}
                            />
                            <div className={`w-5 h-5 border-2 rounded transition-colors flex items-center justify-center
                ${isChecked
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'border-[var(--text-secondary)] group-hover:border-[var(--text-primary)]'
                                }`}
                            >
                                {isChecked && <X className="w-3.5 h-3.5 text-white rotate-45 transform origin-center translate-y-[1px]" style={{ strokeWidth: 4 }} />}
                                {/* Custom checkmark using lucide X rotated because lucide Check is thin. Or simple SVG check. */}
                                {isChecked && (
                                    <svg className="w-3.5 h-3.5 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        <span className="text-sm text-[var(--text-secondary)] select-none">
                            I have read and understood the above-stated CFD Risk Disclosure and acknowledge the same.
                        </span>
                    </label>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex justify-center">
                    <button
                        onClick={handleAgree}
                        disabled={!isChecked}
                        className={`px-8 py-3 rounded-lg font-bold text-sm transition-all duration-200 flex items-center gap-2
              ${isChecked
                                ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-lg transform active:scale-95 hover:shadow-xl'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isChecked ? 'border-white' : 'border-gray-500'}`}>
                            {isChecked && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        I Agree
                    </button>
                </div>

            </div>
        </div>
    );
};

export default RiskDisclosureModal;
