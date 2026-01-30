import react, { useState, useEffect } from 'react';
import { Layers, PieChart, Users, TrendingUp, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
    { name: 'Watchlist', icon: Layers, href: '/watchlist' },
    { name: 'Order', icon: TrendingUp, href: '/orders' },
    { name: 'Funds', icon: PieChart, href: '/funds' },
    { name: 'Portfolio', icon: Users, href: '/portfolio' },
    { name: 'Profile', icon: User, href: '/profile' },
];

const NavBar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // The active state should be derived directly from location.pathname for reliable routing
    const NavItem = ({ item }) => {
        // Use location.pathname directly for determining the active state
        const isActive = location.pathname.includes(item.href) && item.href !== '/';
        const IconComponent = item.icon;

        return (
            <button
                onClick={() => {
                    // No need to call setActiveTab, the useEffect in the parent handles this
                    navigate(item.href);
                }}
                className={`
                    flex flex-col lg:flex-row items-center justify-center 
                    cursor-pointer p-2 lg:px-4 lg:py-1 
                    transition duration-200 ease-in-out relative
                    
                    ${isActive
                        ? 'text-indigo-500 lg:bg-indigo-500/20 rounded-lg'
                        : 'text-[var(--nav-text-inactive)] hover:text-[var(--nav-text-hover)] lg:hover:bg-[var(--bg-hover)]'
                    }
                    
                    ${isActive
                        ? 'lg:border-b-4 lg:border-indigo-500'
                        : 'lg:border-b-4 lg:border-transparent'
                    }
                `}
            >
                <IconComponent className="w-5 h-5 mb-1 lg:mb-0" />
                <span className="text-[10px] font-medium lg:text-sm lg:font-medium lg:ml-2">{item.name}</span>
            </button>
        );
    };

    return (
        <>
            {/* Desktop Header/Navigation Bar (Visible at the TOP on large screens) */}
            <header className="hidden lg:flex justify-between items-center px-6 py-2 bg-[var(--bg-nav)] border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center border border-[var(--border-color)]">
                        <span className="text-white font-bold text-lg font-sans">DL</span>
                    </div>
                    <span className="text-xl font-bold text-[var(--text-primary)]">{localStorage.getItem('organizationName') || 'DHANLAXMI'}</span>
                </div>
                <nav className="flex space-x-6">
                    {NAV_ITEMS.map(item => (
                        <NavItem key={item.name} item={item} />
                    ))}
                </nav>
            </header>

            {/* Mobile Footer Navigation Bar (Fixed at the BOTTOM on small screens) */}
            <nav
                className="
                    fixed bottom-0 left-0 right-0 z-50
                    bg-[var(--bg-nav)] grid grid-cols-5 px-2 py-1 border-t border-[var(--border-color)]
                    lg:hidden 
                "
            >
                {NAV_ITEMS.map(item => (
                    // Reusing NavItem for mobile layout
                    <NavItem key={item.name} item={item} />
                ))}
            </nav>
        </>
    );
};

export default NavBar;
