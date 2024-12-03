import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const KlineChart = ({ data, inflectionPoints, onCursorMove }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const lastCursorTimeRef = useRef(null);
  const lastActivePointRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data.length) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: '#ffffff' },
        textColor: '#333',
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 3,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
    });
    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candlestickSeriesRef.current = candlestickSeries;

    candlestickSeries.setData(data);

    // Initial markers setup
    const setupInitialMarkers = () => {
      if (!inflectionPoints?.length) return;
      
      const firstDataTime = data[0].time;
      const markers = inflectionPoints
        .filter(point => {
          const pointTime = new Date(point.date).getTime() / 1000;
          return pointTime >= firstDataTime;
        })
        .map(point => ({
          time: new Date(point.date).getTime() / 1000,
          position: 'aboveBar',
          color: '#2196F3',
          shape: 'circle',
          text: '',
          size: 1
        }));
      
      candlestickSeries.setMarkers(markers);
    };

    setupInitialMarkers();
    chart.timeScale().fitContent();

    // Update crosshair move handler
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !inflectionPoints?.length) {
        // Clear last active point when cursor leaves chart
        if (lastActivePointRef.current !== null) {
          setupInitialMarkers();
          lastActivePointRef.current = null;
        }
        return;
      }

      const cursorTime = param.time * 1000;
      if (cursorTime === lastCursorTimeRef.current) return;
      
      lastCursorTimeRef.current = cursorTime;
      onCursorMove(cursorTime);

      // Find the nearest inflection point
      const DETECTION_RANGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      let nearestPoint = null;
      let minTimeDiff = Infinity;

      inflectionPoints.forEach(point => {
        const pointTime = new Date(point.date).getTime();
        const timeDiff = Math.abs(cursorTime - pointTime);
        
        if (timeDiff < DETECTION_RANGE && timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          nearestPoint = point;
        }
      });

      // Only update markers if the nearest point has changed
      if (nearestPoint?.date !== lastActivePointRef.current) {
        lastActivePointRef.current = nearestPoint?.date;

        const firstDataTime = data[0].time;
        const markers = inflectionPoints
          .filter(point => {
            const pointTime = new Date(point.date).getTime() / 1000;
            return pointTime >= firstDataTime;
          })
          .map(point => ({
            time: new Date(point.date).getTime() / 1000,
            position: 'aboveBar',
            color: '#2196F3',
            shape: 'circle',
            text: point.date === nearestPoint?.date ? 
              new Date(point.date).toLocaleDateString() : '',
            size: 1
          }));

        candlestickSeries.setMarkers(markers);
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, inflectionPoints, onCursorMove]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default KlineChart; 