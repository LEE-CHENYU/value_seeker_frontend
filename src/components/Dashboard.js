import React, { useState, useEffect, useRef, useCallback } from 'react';
import KlineChart from './KlineChart';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const Dashboard = () => {
  const [symbol, setSymbol] = useState('OXY');
  const [klineData, setKlineData] = useState([]);
  const [inflectionPoints, setInflectionPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('OXY');
  const [newsData, setNewsData] = useState([]);
  const [newsSummary, setNewsSummary] = useState('');
  const newsContainerRef = useRef(null);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(',', '').replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
  };

  const NewsItem = ({ date, title, priceChange }) => {
    const priceChangeColor = priceChange >= 0 
      ? 'bg-green-50 text-green-600' 
      : 'bg-red-50 text-red-600';
    const priceChangeText = `${(priceChange >= 0 ? '+' : '')}${priceChange.toFixed(1)}%`;
    
    return (
      <div className="p-4 bg-white rounded-lg shadow-sm mb-3 border-2 border-gray-100 hover:border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-900 font-medium">{date}</span>
          <span className={`px-3 py-1 rounded-full ${priceChangeColor} font-medium text-sm`}>
            {priceChangeText}
          </span>
        </div>
        <p className="text-gray-900">{title}</p>
      </div>
    );
  };

  const validateAndFetchData = async (stockSymbol) => {
    try {
      setLoading(true);
      setError(null);
      console.log(`[News] Starting data fetch for symbol: ${stockSymbol}`);
      
      const searchResponse = await fetch(`http://localhost:8080/stock_api/api/v1/search/${stockSymbol}`);
      const searchResult = await searchResponse.json();
      console.log('[News] Search response:', searchResult);
      
      if (!searchResponse.ok) {
        console.error('[News] Invalid stock symbol:', searchResult.error);
        setError(searchResult.error || 'Invalid stock symbol');
        setLoading(false);
        return;
      }

      console.log('[News] Fetching multiple data sources...');
      const [klineResponse, inflectionResponse, newsResponse] = await Promise.all([
        fetch(`http://localhost:8080/api/kline?symbol=${stockSymbol}`),
        fetch(`http://localhost:8080/stock_api/api/v1/inflection-points/${stockSymbol}`),
        fetch(`http://localhost:8080/stock_api/news/by-inflection/${stockSymbol}`)
      ]);

      console.log('[News] Response status codes:', {
        kline: klineResponse.status,
        inflection: inflectionResponse.status,
        news: newsResponse.status
      });

      if (!newsResponse.ok) {
        console.warn(`[News] News data not available for ${stockSymbol}`, {
          status: newsResponse.status,
          statusText: newsResponse.statusText
        });
        
        const rawResponse = await newsResponse.text();
        console.log('[News] Raw response:', rawResponse);
        
        setNewsData([]);
        setNewsSummary('No market driver data available for this stock.');
        
        const klineResult = await klineResponse.json();
        const inflectionResult = await inflectionResponse.json();
        
        if (klineResult.success) {
          setSymbol(stockSymbol.toUpperCase());
          setKlineData(klineResult.data);
          setInflectionPoints(inflectionResult || []);
        } else {
          setError(klineResult.error || 'Failed to fetch data');
        }
        return;
      }

      console.log('[News] Parsing JSON responses...');
      const [klineResult, inflectionResult, newsResult] = await Promise.all([
        klineResponse.json(),
        inflectionResponse.json(),
        newsResponse.json()
      ]);
      
      console.log('[News] Parsed results:', {
        klineSuccess: klineResult.success,
        inflectionPointsCount: inflectionResult?.length,
        newsDataAvailable: Boolean(newsResult?.data)
      });
      
      if (klineResult.success) {
        setSymbol(stockSymbol.toUpperCase());
        setKlineData(klineResult.data);
        setInflectionPoints(inflectionResult || []);
        
        if (newsResult.success && newsResult.data) {
          console.log('[News] Processing news data...');
          
          const newsItems = Object.entries(newsResult.data)
            .flatMap(([date, data]) => 
              data.news?.map(article => ({
                timestamp: new Date(article.news_article.publishedDate).getTime(),
                date: formatDate(article.news_article.publishedDate),
                title: article.news_article.title,
                priceChange: data.inflection?.price_change || 0
              })) || []
            )
            .sort((a, b) => b.timestamp - a.timestamp);

          console.log('[News] Sorted news items:', newsItems);
          setNewsData(newsItems);
        } else {
          console.warn('[News] News data not available or invalid:', newsResult);
          setNewsData([]);
          setNewsSummary('No market driver data available for this stock.');
        }
      } else {
        console.error('[News] Failed to fetch kline data:', klineResult.error);
        setError(klineResult.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('[News] Error in validateAndFetchData:', err);
      setError('Failed to fetch data: ' + err.message);
    } finally {
      console.log('[News] Data fetch completed');
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

  const handleChartCursorMove = useCallback((cursorTime) => {
    if (!newsContainerRef.current || !newsData.length) return;

    // Find the closest news item to the cursor time
    const closestNews = newsData.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.timestamp - cursorTime);
      const currDiff = Math.abs(curr.timestamp - cursorTime);
      return currDiff < prevDiff ? curr : prev;
    });

    // Find the news item element
    const newsElement = newsContainerRef.current.querySelector(
      `[data-timestamp="${closestNews.timestamp}"]`
    );

    if (newsElement) {
      newsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      // Add highlight effect
      newsElement.classList.add('bg-blue-50');
      setTimeout(() => {
        newsElement.classList.remove('bg-blue-50');
      }, 1000);
    }
  }, [newsData]);

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
              <KlineChart 
                data={klineData} 
                inflectionPoints={inflectionPoints}
                onCursorMove={handleChartCursorMove}
              />
            )}
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow h-2/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Market Drivers</h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-50 hover:bg-gray-100">
                News
              </button>
              <button className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-100">
                Events
              </button>
              <button className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-100">
                Social
              </button>
            </div>
          </div>
          
          <div 
            ref={newsContainerRef}
            className="overflow-auto h-[calc(100%-4rem)]"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading...
              </div>
            ) : error ? (
              <div className="p-4 text-red-600 bg-red-100 rounded-lg">
                {error}
              </div>
            ) : newsData.length > 0 ? (
              <div className="space-y-3 px-1">
                {newsData.map((item, index) => (
                  <div
                    key={`${item.timestamp}-${index}`}
                    data-timestamp={item.timestamp}
                    className="transition-colors duration-300"
                  >
                    <NewsItem
                      date={item.date}
                      title={item.title}
                      priceChange={item.priceChange}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No market driver data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;