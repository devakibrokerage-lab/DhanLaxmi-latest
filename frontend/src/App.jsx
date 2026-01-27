import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// === CRITICAL TRADING PAGES - EAGER LOAD (0ms navigation) ===
import LoginForm from "./page/Login/LoginForm.jsx";
import RegistrationForm from "./page/Registration/RegistrationForm.jsx";
import Watchlist from './page/WatchList/Watchlist.jsx';
import Layout from './page/Layout';
import Orders from './page/Orders/Order.jsx';
import SearchPage from './page/Search/SearchPage.jsx';

// === VERSION CHECKER - Auto-update on new deployments ===
import VersionChecker from './components/VersionChecker.jsx';

// === SECONDARY PAGES - LAZY LOAD (preloaded after login) ===
const Portfolio = lazy(() => import('./page/Portfolio/Portfolio.jsx'));
const Invoice = lazy(() => import('./page/Portfolio/Invoice.jsx'));
const FundPage = lazy(() => import("./page/Funds/FundView.jsx"));
const Profile = lazy(() => import('./page/Profile/Profile.jsx'));
const ChartPage = lazy(() => import('./page/Chart/ChartPage.jsx'));

// === ADMIN/RARE PAGES - LAZY LOAD (load on demand) ===
const BrockerDetailPage = lazy(() => import('./page/User/BrockerDetailPage.jsx'));
const CustomerDetailsPage = lazy(() => import('./page/User/CutomerDetailPage.jsx'));
const RecycleBin = lazy(() => import('./page/User/RecycleBin.jsx'));
const AdminRegistrations = lazy(() => import('./page/Admin/AdminRegistrations.jsx'));
const AdminAccessToken = lazy(() => import('./page/Admin/AdminAccessToken.jsx'));

import { MarketDataProvider } from './contexts/MarketDataContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';

// Smart preload function - called after login to cache secondary pages
export const preloadSecondaryPages = () => {
    // Preload in background (non-blocking)
    setTimeout(() => {
        import('./page/Portfolio/Portfolio.jsx');
        import('./page/Funds/FundView.jsx');
        import('./page/Profile/Profile.jsx');
        import('./page/Chart/ChartPage.jsx');
    }, 1000); // Wait 1 second after login before preloading
};

// Minimal loading fallback (only for lazy-loaded pages)
const PageLoader = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)'
    }}>
        <div>Loading...</div>
    </div>
);

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <MarketDataProvider>
                    {/* Version Checker - Shows update banner when new version available */}
                    <VersionChecker />

                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route path="/" element={<LoginForm />} />
                            <Route path="/register" element={<RegistrationForm />} />
                            <Route path="/brockerDetail" element={<BrockerDetailPage />} />
                            <Route path="/customerDetail" element={<CustomerDetailsPage />} />
                            <Route path="/broker/:brokerId/customerDetail" element={<CustomerDetailsPage />} />
                            <Route path="/recycle-bin" element={<RecycleBin />} />

                            {/* Admin Routes */}
                            <Route path="/admin/registrations" element={<AdminRegistrations />} />
                            <Route path="/admin/access-token" element={<AdminAccessToken />} />
                            <Route
                                path="/watchlist"
                                element={
                                    <Layout>
                                        <Watchlist />
                                    </Layout>
                                }
                            />

                            <Route
                                path="/portfolio"
                                element={
                                    <Layout>
                                        <Portfolio />
                                    </Layout>
                                }
                            />

                            <Route
                                path="/portfolio/invoice"
                                element={
                                    <Layout>
                                        <Invoice />
                                    </Layout>
                                }
                            />

                            <Route
                                path="/funds"
                                element={
                                    <Layout>
                                        <FundPage />
                                    </Layout>
                                }
                            />

                            <Route
                                path="/orders"
                                element={
                                    <Layout>
                                        <Orders />
                                    </Layout>
                                }
                            />

                            <Route
                                path="/profile"
                                element={
                                    <Layout>
                                        <Profile />
                                    </Layout>
                                }
                            />

                            <Route
                                path="/search"
                                element={
                                    <Layout>
                                        <SearchPage />
                                    </Layout>
                                }
                            />

                            <Route
                                path="/chart/:instrument_token"
                                element={<ChartPage />}
                            />
                        </Routes>
                    </Suspense>
                </MarketDataProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;
