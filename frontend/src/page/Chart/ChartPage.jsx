import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StockChart from './StockChart.jsx';

function ChartPage() {
  // Now using single instrument_token param instead of segment/securityId
  const { instrument_token } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [instrumentData, setInstrumentData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch instrument details using instrument_token
  useEffect(() => {
    const fetchInstrumentData = async () => {
      try {
        const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:8080';
        const url = `${baseUrl}/api/instruments/lookup?instrument_token=${instrument_token}`;

        console.log('[ChartPage] Fetching instrument from:', url);

        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          console.log('[ChartPage] Instrument data received:', data);
          setInstrumentData(data);
        } else {
          const errorText = await response.text();
          console.error('[ChartPage] API error:', response.status, errorText);
          setInstrumentData({
            instrument_token,
            tradingsymbol: `Token: ${instrument_token}`,
            name: 'Unknown Instrument'
          });
        }
      } catch (error) {
        console.error('[ChartPage] Failed to fetch instrument:', error);
        setInstrumentData({
          instrument_token,
          tradingsymbol: `Token: ${instrument_token}`,
          name: 'Unknown Instrument'
        });
      } finally {
        setLoading(false);
      }
    };

    if (instrument_token) {
      fetchInstrumentData();
    }
  }, [instrument_token]);

  // Get URL parameters for chart state (read-only)
  const urlInterval = searchParams.get('interval');
  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');

  // Display name for header
  const displayName = instrumentData?.name || instrumentData?.tradingsymbol || `Token: ${instrument_token}`;
  const segment = instrumentData?.segment || '';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 bg-[var(--bg-card)] rounded-lg p-4 shadow-lg">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {loading ? 'Loading...' : displayName}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {segment} • {instrumentData?.tradingsymbol}
            </p>
          </div>
        </div>

        {/* Full-Screen Chart */}
        <StockChart
          instrument_token={instrument_token}
          tradingSymbol={instrumentData?.tradingsymbol}
          instrumentData={instrumentData}
          initialInterval={urlInterval}
          initialFrom={urlFrom}
          initialTo={urlTo}
        />
      </div>
    </div>
  );
}

export default ChartPage;
