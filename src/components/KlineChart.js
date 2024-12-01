import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const KlineChart = ({ data, inflectionPoints, onCursorMove }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

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

    candlestickSeries.setData(data);

    if (inflectionPoints && inflectionPoints.length > 0) {
      const markers = inflectionPoints.map(point => ({
        time: new Date(point.date).getTime() / 1000,
        position: 'aboveBar',
        color: '#2196F3',
        shape: 'circle',
        text: new Date(point.date).toLocaleDateString(),
        size: 1
      }));
      
      candlestickSeries.setMarkers(markers);
    }

    chart.timeScale().fitContent();

    // Add crosshair move handler
    chart.subscribeCrosshairMove(param => {
      if (param.time) {
        const cursorTime = param.time * 1000; // Convert to milliseconds
        onCursorMove(cursorTime);
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