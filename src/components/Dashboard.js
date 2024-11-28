import React, { useState, useEffect } from 'react';
import KlineChart from './KlineChart';

const Dashboard = () => {
  const [symbol, setSymbol] = useState('AAPL');
  const [klineData, setKlineData] = useState([]);
  const [inflectionPoints, setInflectionPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async (stockSymbol) => {
    try {
      setLoading(true);
      const [klineResponse, inflectionResponse] = await Promise.all([
        fetch(`http://localhost:8080/api/kline?symbol=${stockSymbol}`),
        fetch(`http://localhost:8080/stock_api/api/v1/inflection-points/${stockSymbol}`)
      ]);

      const klineResult = await klineResponse.json();
      const inflectionResult = await inflectionResponse.json();
      
      if (klineResult.success) {
        setKlineData(klineResult.data);
        setInflectionPoints(inflectionResult || []);
      } else {
        setError(klineResult.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(symbol);
  }, [symbol]);

  const handleSearch = () => {
    fetchData(symbol);
  };

  return (
    <div className="flex flex-col w-full h-screen bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white border-b">
        <h1 className="text-xl font-bold">FindMarketDriver</h1>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Enter stock symbol..." 
            className="px-3 py-1 border rounded"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
          <button 
            className="px-4 py-1 text-white bg-blue-600 rounded hover:bg-blue-700"
            onClick={handleSearch}
          >
            Search
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Chart Section */}
        <div className="p-4 bg-white rounded-lg shadow h-3/5">
          <h2 className="mb-2 text-lg font-semibold">Price Movement - {symbol}</h2>
          <div className="h-[calc(100%-2rem)] bg-gray-50 border rounded">
            {loading && (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading...
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center h-full text-red-500">
                {error}
              </div>
            )}
            {!loading && !error && klineData.length > 0 && (
              <KlineChart data={klineData} inflectionPoints={inflectionPoints} />
            )}
          </div>
        </div>

        {/* Market Drivers Section */}
        <div className="p-4 bg-white rounded-lg shadow h-2/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Market Drivers</h2>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">News</button>
              <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Events</button>
              <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Social</button>
            </div>
          </div>
          
          {/* News/Events List */}
          <div className="space-y-2 overflow-auto h-48">
            {[1, 2, 3].map((item) => (
              <div key={item} className="p-3 border rounded hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">2024-03-11 09:30 AM</span>
                  <span className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded-full">
                    +2.5%
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  Company announced breakthrough in AI technology...
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;