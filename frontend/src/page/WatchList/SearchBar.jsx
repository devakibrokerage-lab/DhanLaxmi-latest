// SearchBar.jsx (CREATE THIS FILE)
import React from 'react';
import { Search } from 'lucide-react';

/**
 * A reusable component for filtering the watchlist.
 * @param {string} searchTerm - The current value of the search input.
 * @param {function} setSearchTerm - The function to update the search term state.
 */
function SearchBar({ searchTerm, setSearchTerm }) {
    return (
        <div className="relative mt-3">
            <Search className="w-4 h-4 absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-500" />
            <input
                type="text"
                placeholder="Search symbols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 pl-10 pr-4 bg-[#21283D] text-white rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition border border-[#21283D] placeholder-gray-500"
            />
        </div>
    );
}

export default SearchBar;