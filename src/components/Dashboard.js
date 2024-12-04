import React, { useState, useEffect, useRef, useCallback } from 'react';
import KlineChart from './KlineChart';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { debounce } from 'lodash';

const MAX_MODEL_CHARS = 4000;

const summarizeContent = async (articles, config = {
  type: 'key-points',
  format: 'plain-text',
  length: 'short'
}) => {
  try {
    if (!window.ai || !window.ai.summarizer) {
      throw new Error('AI Summarization is not supported in this browser');
    }

    // Prepare the content to summarize
    const content = articles.map(article => {
      return `
Title: ${article.title || 'N/A'}
Source: ${article.source || 'N/A'}
Content: ${article.content || ''}
      `.trim();
    }).join('\n\n');

    if (content.length > MAX_MODEL_CHARS) {
      console.warn('Content too long for summarization, truncating...');
      return {
        summary: 'Content too long for detailed summarization',
        keyFindings: [],
        riskFactors: []
      };
    }

    // Create summarizer session
    const session = await window.ai.summarizer.create({
      ...config,
      language: 'en' // Force English output
    });
    await session.ready;

    // Generate summary
    const summary = await session.summarize(content);
    session.destroy();

    // Parse the summary into structured format, focusing on key points only
    const sections = summary.split('\n\n').reduce((acc, section) => {
      if (section.startsWith('Key Findings:')) {
        acc.keyFindings = section
          .replace('Key Findings:', '')
          .split('\n')
          .map(point => point.trim())
          .filter(point => point)
          // Filter out points starting with - or * and remove any leading special characters
          .map(point => point.replace(/^[-*•\s]+/, ''))
          .filter(point => /^[A-Za-z0-9]/.test(point)); // Only keep points starting with alphanumeric
      } else {
        // Use the main summary as bullet points
        acc.summary = section.trim()
          .split('\n')
          .map(point => point.trim())
          .filter(point => point)
          // Filter out points starting with - or * and remove any leading special characters
          .map(point => point.replace(/^[-*•\s]+/, ''))
          .filter(point => /^[A-Za-z0-9]/.test(point)); // Only keep points starting with alphanumeric
      }
      return acc;
    }, { summary: [], keyFindings: [] });

    return sections;

  } catch (e) {
    console.error('Summarization failed:', e);
    // Return article titles as fallback summary
    return {
      summary: articles.map(article => article.title).filter(Boolean),
      keyFindings: []
    };
  }
};

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
  const [loadingSummaries, setLoadingSummaries] = useState({});

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

  const summarizeArticle = async (itemIndex) => {
    // Check if summary is already loading or loaded
    if (loadingSummaries[itemIndex] || newsData[itemIndex].summary) return;

    // Mark as loading
    setLoadingSummaries(prev => ({ ...prev, [itemIndex]: true }));

    const articles = newsData[itemIndex].newsArticle;

    // Summarize articles
    const summarized = await summarizeContent(articles);

    // Update the news item with the summary and analysis
    setNewsData(prevNewsData => {
      const updatedNewsData = [...prevNewsData];
      updatedNewsData[itemIndex] = {
        ...updatedNewsData[itemIndex],
        summary: summarized.summary,
        analysis: summarized // Include keyFindings and riskFactors
      };
      return updatedNewsData;
    });

    // Mark as not loading
    setLoadingSummaries(prev => ({ ...prev, [itemIndex]: false }));
  };

  const NewsItem = ({ item, index }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const priceChangeColor = item.priceChange >= 0 
      ? 'bg-green-50 text-green-600' 
      : 'bg-red-50 text-red-600';
    const priceChangeText = `${(item.priceChange >= 0 ? '+' : '')}${item.priceChange.toFixed(1)}%`;
    
    const getPrimaryTagColor = (type) => {
      const colors = {
        'Market': 'bg-blue-100 text-blue-800',
        'Financial': 'bg-purple-100 text-purple-800',
        'Corporate Governance': 'bg-orange-100 text-orange-800',
        'Environmental': 'bg-green-100 text-green-800',
        'Product': 'bg-yellow-100 text-yellow-800',
      };
      return colors[item.eventClassification?.primary_type] || 'bg-gray-100 text-gray-800';
    };

    const getSeverityColor = (severity) => {
      const colors = {
        1: 'text-gray-600',
        2: 'text-blue-600',
        3: 'text-yellow-600',
        4: 'text-orange-600',
        5: 'text-red-600'
      };
      return colors[item.eventClassification?.severity] || 'text-gray-600';
    };

    // Use summary for bullet points if available, otherwise create fallback summary
    const bulletPoints = Array.isArray(item.summary) ? item.summary : 
      typeof item.summary === 'string' ? item.summary.split(';').filter(point => point.trim()) :
      item.newsArticle.map(article => article.title).filter(Boolean);

    const summarizeAnalysis = () => {
      const allFindings = new Set();
      const allRisks = new Set();
      
      if (Array.isArray(item.analysis)) {
        item.analysis.forEach(a => {
          a.key_findings?.forEach(f => allFindings.add(f));
          a.risk_factors?.forEach(r => allRisks.add(r));
        });
      } else if (item.analysis) {
        item.analysis.key_findings?.forEach(f => allFindings.add(f));
        item.analysis.risk_factors?.forEach(r => allRisks.add(r));
      }

      return {
        findings: Array.from(allFindings),
        risks: Array.from(allRisks)
      };
    };

    const summarizeArticles = () => {
      const articles = !Array.isArray(item.newsArticle) ? [item.newsArticle] : item.newsArticle;
      return articles.reduce((acc, article) => {
        if (!article) return acc;
        const type = article.type || 'Other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(article);
        return acc;
      }, {});
    };

    const articles = summarizeArticles();
    const totalArticles = Object.values(articles).flat().length;

    const { findings, risks } = summarizeAnalysis();

    useEffect(() => {
      if (isExpanded && !item.summary) {
        summarizeArticle(index);
      }
    }, [isExpanded]);

    return (
      <div 
        data-timestamp={item.timestamp}
        className="p-4 bg-white rounded-lg shadow-sm mb-3 border-2 border-gray-100 hover:border-gray-200 cursor-pointer transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-900 font-medium">{item.date}</span>
          <span className={`px-3 py-1 rounded-full ${priceChangeColor} font-medium text-sm`}>
            {priceChangeText}
          </span>
        </div>
        
        {item.eventClassification && (
          <div className="mb-3">
            <div className="flex items-center gap-2">
              {item.eventClassification.primary_type && (
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getPrimaryTagColor(item.eventClassification.primary_type)}`}>
                  {item.eventClassification.primary_type}
                </span>
              )}
              {item.eventClassification.sub_type && (
                <span className="text-xs text-gray-500">
                  {item.eventClassification.sub_type}
                </span>
              )}
            </div>
          </div>
        )}

        <ul className="text-gray-900 space-y-1 pl-5 list-disc mb-3">
          {bulletPoints.map((point, idx) => (
            <li key={idx} className="text-sm">
              {point.trim()}
            </li>
          ))}
        </ul>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {loadingSummaries[index] && (
              <div className="text-sm text-gray-500">Loading summary...</div>
            )}
            {!loadingSummaries[index] && (
              <>
                {totalArticles > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Related Articles ({totalArticles})</h4>
                    {Object.entries(articles).map(([type, typeArticles]) => (
                      <div key={type} className="mb-4">
                        <h5 className="text-xs font-medium text-gray-600 mb-2">{type} ({typeArticles.length})</h5>
                        <div className="space-y-3">
                          {typeArticles.map((article, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                              <div className="space-y-1 text-sm">
                                {article?.title && (
                                  <p>
                                    <span className="font-medium">Title: </span>
                                    {article.url ? (
                                      <a 
                                        href={article.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {article.title}
                                      </a>
                                    ) : (
                                      article.title
                                    )}
                                  </p>
                                )}
                                {article?.source && <p><span className="font-medium">Source: </span>{article.source}</p>}
                                {article?.publishedDate && (
                                  <p>
                                    <span className="font-medium">Published: </span>
                                    {formatDate(article.publishedDate)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(findings.length > 0 || risks.length > 0) && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Analysis Summary</h4>
                    {findings.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">Key Findings:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          {findings.map((finding, index) => (
                            <li key={index} className="text-sm">{finding}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {risks.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Risk Factors:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          {risks.map((risk, index) => (
                            <li key={index} className="text-sm text-red-600">{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {item.marketEvent && item.marketEvent.type && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Event Details</h4>
                    <p className="text-sm"><span className="font-medium">Type:</span> {item.marketEvent.type}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {item.eventClassification && (
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
            {item.eventClassification.severity && (
              <span className={`${getSeverityColor(item.eventClassification.severity)}`}>
                Severity {item.eventClassification.severity}
              </span>
            )}
            {item.eventClassification.confidence && (
              <span>
                {Math.round(item.eventClassification.confidence * 100)}% confidence
              </span>
            )}
            {item.eventClassification.impact_duration && (
              <span>
                {item.eventClassification.impact_duration.replace(/_/g, ' ').toLowerCase()}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const validateAndFetchData = useCallback(async (stockSymbol) => {
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
        console.warn(`[News] News data not available for ${stockSymbol}`);
        setNewsData([]);
        setNewsSummary('No market driver data available for this stock.');
        
        const rawResponse = await newsResponse.text();
        console.log('[News] Raw response:', rawResponse);
        
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
          
          // Modify the news processing part in validateAndFetchData
          const newsItems = await Promise.all(Object.entries(newsResult.data)
            .map(async ([date, data]) => {
              if (!Array.isArray(data.news) || data.news.length === 0) {
                return null;
              }

              // Prepare articles for summarization
              const articles = data.news.map(article => ({
                title: article.news_article?.title,
                source: article.news_article?.source,
                content: article.news_article?.content,
                publishedDate: article.news_article?.publishedDate,
                url: article.news_article?.url,
                analysis: article.analysis // Include analysis data
              }));

              // Generate summary using on-device AI
              const summarized = await summarizeContent(articles);

              // Combine key findings and risk factors from the original analysis data
              const allFindings = new Set();
              const allRisks = new Set();

              articles.forEach(article => {
                article.analysis?.key_findings?.forEach(finding => allFindings.add(finding));
                article.analysis?.risk_factors?.forEach(risk => allRisks.add(risk));
              });

              return {
                timestamp: new Date(data.news[0].news_article.publishedDate).getTime(),
                date: formatDate(data.news[0].news_article.publishedDate),
                summary: summarized.summary,
                analysis: {
                  key_findings: Array.from(allFindings),
                  risk_factors: Array.from(allRisks)
                },
                priceChange: data.inflection?.price_change || 0,
                eventClassification: {
                  primary_type: data.news[0].event_classification?.primary_type,
                  sub_type: data.news[0].event_classification?.sub_type,
                  severity: Math.max(...data.news.map(n => n.event_classification?.severity || 0)),
                  confidence: Math.max(...data.news.map(n => n.event_classification?.confidence || 0)),
                  impact_duration: data.news[0].event_classification?.impact_duration
                },
                newsArticle: articles,
                marketEvent: data.news[0].market_event
              };
            }));

          const validNewsItems = newsItems
            .filter(Boolean)
            .sort((a, b) => b.timestamp - a.timestamp);

          setNewsData(validNewsItems);
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
      setNewsData([]);
      setNewsSummary('Error loading market driver data.');
    } finally {
      console.log('[News] Data fetch completed');
      setLoading(false);
    }
  }, []);

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
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md ml-4">
          <input 
            type="text" 
            placeholder="Enter stock symbol..." 
            className="px-3 py-1 border rounded flex-1"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
          />
          <button 
            type="submit"
            className="px-4 py-1 text-white bg-blue-600 rounded hover:bg-blue-700 whitespace-nowrap"
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
        
        <div className="p-4 bg-white rounded-lg shadow h-2/5">
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

        <div className="p-4 bg-white rounded-lg shadow h-3/5">
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
                  <NewsItem
                    key={`${item.timestamp}-${index}`}
                    item={item}      // Pass the news item
                    index={index}    // Pass the index
                  />
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