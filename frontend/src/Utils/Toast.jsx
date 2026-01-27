
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";

import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";


function Toast({ message, type, show }){
  if (!show) return null;

  return (
    // Wrapper: Ye screen ki full width leta hai aur content ko forcefully center karta hai
    // pointer-events-none isliye taki side ki khali jagah pe click ho sake
    <div className="fixed top-6 left-0 w-full flex justify-center z-50 pointer-events-none">
      
      {/* Toast Box */}
      <div className={`px-4 sm:px-6 py-2 rounded-full shadow-lg flex items-center gap-2 sm:gap-3 
        pointer-events-auto min-w-[280px] sm:min-w-[320px] max-w-[90vw] sm:max-w-md
        animate-toast backdrop-blur-md border
        ${type === 'success' 
          ? 'bg-green-500/85 border-green-400/50 text-white shadow-green-500/20' 
          : 'bg-red-500/85 border-red-400/50 text-white shadow-red-500/20'
        }`}
      >
        {/* Icon (Optional for better look) */}
        {type === 'success' ? (
           <div className="bg-white/20 rounded-full p-0.5">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
           </div>
        ) : (
           <div className="bg-white/20 rounded-full p-0.5">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
           </div>
        )}

        <span className="font-medium text-sm tracking-wide">{message}</span>

        {/* Animation Style: Ab hume horizontal translate ki zarurat nahi hai, sirf vertical (Y) */}
        <style>{`
          @keyframes slideDown {
            from { transform: translateY(-150%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .animate-toast {
            animation: slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }
        `}</style>
      </div>
    </div>
  );
};

export default Toast;

