import React, { useState, useEffect } from 'react';
import KlineChart from './KlineChart';

const Dashboard = () => {
  const [symbol, setSymbol] = useState('AAPL');
  const [klineData, setKlineData] = useState([]);
  const [inflectionPoints, setInflectionPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('AAPL');

  const validateAndFetchData = async (stockSymbol) => {
    try {
      setLoading(true);
      setError(null);
      
      const searchResponse = await fetch(`http://localhost:8080/stock_api/api/v1/search/${stockSymbol}`);
      const searchResult = await searchResponse.json();
      
      if (!searchResponse.ok) {
        setError(searchResult.error || 'Invalid stock symbol');
        setLoading(false);
        return;
      }

      const [klineResponse, inflectionResponse] = await Promise.all([
        fetch(`http://localhost:8080/api/kline?symbol=${stockSymbol}`),
        fetch(`http://localhost:8080/stock_api/api/v1/inflection-points/${stockSymbol}`)
      ]);

      const klineResult = await klineResponse.json();
      const inflectionResult = await inflectionResponse.json();
      
      if (klineResult.success) {
        setSymbol(stockSymbol.toUpperCase());
        setKlineData(klineResult.data);
        setInflectionPoints(inflectionResult || []);
      } else {
        setError(klineResult.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to fetch data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    validateAndFetchData(symbol);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      validateAndFetchData(searchInput.trim().toUpperCase());
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-gray-100">
      <header className="flex items-center justify-between p-4 bg-white border-b">
        <h1 className="text-xl font-bold">FindMarketDriver</h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Enter stock symbol..." 
            className="px-3 py-1 border rounded"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
          />
          <button 
            type="submit"
            className="px-4 py-1 text-white bg-blue-600 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Search'}
          </button>
        </form>
      </header>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {error && (
          <div className="p-2 text-red-600 bg-red-100 rounded">
            {error}
          </div>
        )}
        
        <div className="p-4 bg-white rounded-lg shadow h-3/5">
          <h2 className="mb-2 text-lg font-semibold">Price Movement - {symbol}</h2>
          <div className="h-[calc(100%-2rem)] bg-gray-50 border rounded">
            {loading && (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading...
              </div>
            )}
            {!loading && !error && klineData.length > 0 && (
              <KlineChart data={klineData} inflectionPoints={inflectionPoints} />
            )}
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow h-2/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Market Drivers</h2>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">News</button>
              <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Events</button>
              <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Social</button>
            </div>
          </div>
          
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