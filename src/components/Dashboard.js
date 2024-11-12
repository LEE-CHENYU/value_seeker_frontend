import React from 'react';

const Dashboard = () => {
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
          />
          <button className="px-4 py-1 text-white bg-blue-600 rounded hover:bg-blue-700">
            Search
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Chart Section */}
        <div className="p-4 bg-white rounded-lg shadow h-3/5">
          <h2 className="mb-2 text-lg font-semibold">Price Movement</h2>
          <div className="h-64 bg-gray-50 border rounded">
            <div className="flex items-center justify-center h-full text-gray-500">
              K-line Chart Area
            </div>
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