import React, { useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components to avoid "category is not a registered scale"
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Define props interface
interface ChartProps {
  fpr: number[];
  tpr: number[];
  roc_auc: number;
}

// Use React.FC with generic type
const ChartComponent: React.FC<ChartProps> = ({ fpr, tpr, roc_auc }) => {
  const chartRef = useRef<ChartJS<"line", { x: number; y: number }[], string> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      // Destroy existing chart to prevent "Canvas is already in use" error
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        chartRef.current = new ChartJS(ctx, {
          type: 'line',
          data: {
            labels: fpr.map((_, index) => index.toString()),
            datasets: [
              {
                label: `ROC Curve (AUC = ${roc_auc.toFixed(2)})`,
                data: tpr.map((y, i) => ({ x: fpr[i], y })),
                borderColor: '#0000FF', // Blue
                backgroundColor: 'rgba(0, 0, 255, 0.1)',
                fill: false,
              },
              {
                label: 'Random Guess',
                data: fpr.map((x) => ({ x, y: x })),
                borderColor: '#FF0000', // Red
                borderDash: [5, 5],
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'top' as const },
              title: {
                display: true,
                text: 'Receiver Operating Characteristic (ROC) Curve',
              },
            },
            scales: {
              x: {
                type: 'linear' as const,
                title: { display: true, text: 'False Positive Rate' },
              },
              y: {
                type: 'linear' as const,
                title: { display: true, text: 'True Positive Rate' },
              },
            },
          },
        });
      }
    }

    // Cleanup on unmount or data change
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [fpr, tpr, roc_auc]);

  return <canvas ref={canvasRef} />;
};

export default ChartComponent;