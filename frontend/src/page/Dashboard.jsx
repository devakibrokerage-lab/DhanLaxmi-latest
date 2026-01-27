// Dashboard.jsx

import React from "react";

function Dashboard() {
    return ( 
        <div className="
            // **Change: w-0 on mobile to hide it and let Watchlist take w-full**
            w-0 
            // **Keep desktop styling**
            md:w-1/2 lg:w-9/12 
            
            h-full flex flex-col
        ">
       
            <div className="w-full flex-grow bg-[#2A314A] overflow-y-auto">
                <div className="p-4 text-white/90 h-full">
                    <h2 className="text-xl font-semibold">Trading Chart Area (70% Width)</h2>
                    <p className="text-sm text-gray-400 mt-2">Main Chart Area - Full vertical space fill.</p>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;