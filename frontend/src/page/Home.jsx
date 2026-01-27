import React from 'react';
import Watchlist from './WatchList/Watchlist';
import Dashboard from './Dashboard';
import Layout from './Layout';
import Portfolio from './Portfolio/Portfolio';
import FundsView from './Funds/FundView';
import Order from './Orders/Order';

const Home = () => {
    return (
        <Layout>
            <Portfolio/>
            <Dashboard />
            <Order/>
        </Layout>
    );
};

export default Home;
