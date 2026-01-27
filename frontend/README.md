// App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./page/Layout";
import LoginForm from "./components/LoginForm";
import Watchlist from "./page/WatchList/Watchlist";
import Orders from "./page/Orders/Order";
import Portfolio from "./page/Portfolio/Portfolio";
import FundPage from "./page/Funds/FundManagement";
import Profile from "./page/Profile/Profile";
import BrokerDashboard from "./page/Broker/Dashboard";
import { ScopeProvider } from "./scope/ScopeContext";
import ScopeGuard from "./scope/ScopeGuard";

export default function App() {
  return (
    <BrowserRouter>
      <ScopeProvider>
        <Routes>
          <Route path="/" element={<LoginForm />} />

          {/* Watchlist — always same */}
          <Route
            path="/watchlist"
            element={
              <Layout>
                <Watchlist />
              </Layout>
            }
          />

          {/* Broker Dashboard (super-broker can open any) */}
          <Route
            path="/broker/:brokerId"
            element={
              <Layout>
                <ScopeGuard allow={["super-broker", "broker"]}>
                  <BrokerDashboard />
                </ScopeGuard>
              </Layout>
            }
          />

          {/* Scoped Customer routes */}
          <Route
            path="/broker/:brokerId/customer/:customerId/orders"
            element={
              <Layout>
                <ScopeGuard allow={["super-broker", "broker"]}>
                  <Orders />
                </ScopeGuard>
              </Layout>
            }
          />
          <Route
            path="/broker/:brokerId/customer/:customerId/portfolio"
            element={
              <Layout>
                <ScopeGuard allow={["super-broker", "broker"]}>
                  <Portfolio />
                </ScopeGuard>
              </Layout>
            }
          />
          <Route
            path="/broker/:brokerId/customer/:customerId/funds"
            element={
              <Layout>
                <ScopeGuard allow={["super-broker", "broker"]}>
                  <FundPage />
                </ScopeGuard>
              </Layout>
            }
          />
          <Route
            path="/broker/:brokerId/customer/:customerId/profile"
            element={
              <Layout>
                <ScopeGuard allow={["super-broker", "broker"]}>
                  <Profile />
                </ScopeGuard>
              </Layout>
            }
          />
        </Routes>
      </ScopeProvider>
    </BrowserRouter>
  );
}
