import React, { useState, useEffect } from "react";
import axios from "axios";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const App = () => {
  const [sensorData, setSensorData] = useState([]);
  const [timestamps, setTimestamps] = useState([]);

  // Helper function: Compute statistical features
  const computeStats = (data) => {
    if (!data.length) return {};
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const std = Math.sqrt(data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length);
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const rms = Math.sqrt(data.reduce((sum, val) => sum + Math.pow(val, 2), 0) / data.length);
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(data.length / 4)];
    const q3 = sorted[Math.floor((3 * data.length) / 4)];
    const iqr = q3 - q1;
    return { mean, std, min, max, range, rms, iqr };
  };

  // Helper function: Compute time-series features
  const computeTimeSeriesFeatures = (data) => {
    if (!data.length) return {};
    const cumulativeSum = data.reduce((acc, val, index) => {
      acc.push((acc[index - 1] || 0) + val);
      return acc;
    }, []);
    const zeroCrossings = data.reduce((count, val, index, arr) => {
      if (index === 0) return count;
      return count + (((arr[index - 1] >= 0 && val < 0) || (arr[index - 1] < 0 && val >= 0)) ? 1 : 0);
    }, 0);
    // Simplified entropy calculation using binned data
    const bins = 10;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binSize = (max - min) / bins;
    let counts = Array(bins).fill(0);
    data.forEach(val => {
      let binIndex = Math.min(bins - 1, Math.floor((val - min) / binSize));
      counts[binIndex]++;
    });
    const probabilities = counts.filter(count => count > 0).map(count => count / data.length);
    const entropy = probabilities.reduce((sum, p) => sum - p * Math.log2(p), 0);
    return { cumulativeSum: cumulativeSum[cumulativeSum.length - 1], zeroCrossings, entropy };
  };

  // Helper function: Compute frequency-domain features (dummy implementation)
  // Replace with an actual FFT if required.
  const computeFFTFeatures = (data) => {
    if (!data.length) return {};
    const peak = Math.max(...data);
    const spectralEnergy = data.reduce((sum, val) => sum + Math.pow(val, 2), 0);
    const dominantFrequency = 0; // Placeholder: Replace with actual FFT computation if needed.
    return { peak, spectralEnergy, dominantFrequency };
  };

  // Helper function: Compute magnitude given an array of keys
  const computeMagnitude = (data, keys) =>
    Math.sqrt(keys.reduce((sum, key) => sum + Math.pow(data[key] || 0, 2), 0)).toFixed(2);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/sensor");
        // Append the latest reading, keeping a sliding window of 10 items
        setSensorData((prevData) => [...prevData.slice(-9), response.data]);
        setTimestamps((prevTimestamps) => [...prevTimestamps.slice(-9), new Date().toLocaleTimeString()]);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    const interval = setInterval(fetchData, 300);
    return () => clearInterval(interval);
  }, []);

  // Compute additional metrics arrays
  const accelMagnitude = sensorData.map((data) =>
    computeMagnitude(data, ["AcX", "AcY", "AcZ"])
  );
  const gyroMagnitude = sensorData.map((data) =>
    computeMagnitude(data, ["GyX", "GyY", "GyZ"])
  );

  // Compute summary statistics
  const avgAcX = sensorData.length ? (sensorData.reduce((sum, d) => sum + d.AcX, 0) / sensorData.length).toFixed(2) : 0;
  const avgAcY = sensorData.length ? (sensorData.reduce((sum, d) => sum + d.AcY, 0) / sensorData.length).toFixed(2) : 0;
  const avgAcZ = sensorData.length ? (sensorData.reduce((sum, d) => sum + d.AcZ, 0) / sensorData.length).toFixed(2) : 0;
  const latestBpm = sensorData.length ? sensorData[sensorData.length - 1].bpm : 0;
  const avgAccelMag = accelMagnitude.length ? (accelMagnitude.reduce((sum, val) => sum + Number(val), 0) / accelMagnitude.length).toFixed(2) : 0;
  const avgGyroMag = gyroMagnitude.length ? (gyroMagnitude.reduce((sum, val) => sum + Number(val), 0) / gyroMagnitude.length).toFixed(2) : 0;

  // Compute advanced features for Accelerometer X (AcX)
  const accelXData = sensorData.map(d => d.AcX);
  const accelXStats = computeStats(accelXData);
  const timeSeriesAccelX = computeTimeSeriesFeatures(accelXData);
  const fftAccelX = computeFFTFeatures(accelXData);

  // Main Line Chart Data (sensor channels)
  const mainChartData = {
    labels: timestamps,
    datasets: [
      {
        label: "Accelerometer X",
        data: sensorData.map((data) => data.AcX),
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        pointBackgroundColor: "red",
        pointBorderColor: "white",
        pointRadius: 5,
        tension: 0.4,
      },
      {
        label: "Accelerometer Y",
        data: sensorData.map((data) => data.AcY),
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        pointBackgroundColor: "blue",
        pointBorderColor: "white",
        pointRadius: 5,
        tension: 0.4,
      },
      {
        label: "Accelerometer Z",
        data: sensorData.map((data) => data.AcZ),
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        pointBackgroundColor: "green",
        pointBorderColor: "white",
        pointRadius: 5,
        tension: 0.4,
      },
      {
        label: "Gyroscope X",
        data: sensorData.map((data) => data.GyX),
        borderColor: "rgba(255, 159, 64, 1)",
        backgroundColor: "rgba(255, 159, 64, 0.2)",
        pointBackgroundColor: "orange",
        pointBorderColor: "white",
        pointRadius: 5,
        tension: 0.4,
      },
      {
        label: "Gyroscope Y",
        data: sensorData.map((data) => data.GyY),
        borderColor: "rgba(255, 205, 86, 1)",
        backgroundColor: "rgba(255, 205, 86, 0.2)",
        pointBackgroundColor: "yellow",
        pointBorderColor: "white",
        pointRadius: 5,
        tension: 0.4,
      },
      {
        label: "Gyroscope Z",
        data: sensorData.map((data) => data.GyZ),
        borderColor: "rgba(201, 203, 207, 1)",
        backgroundColor: "rgba(201, 203, 207, 0.2)",
        pointBackgroundColor: "lightgrey",
        pointBorderColor: "white",
        pointRadius: 5,
        tension: 0.4,
      },
      {
        label: "BPM (Heart Rate)",
        data: sensorData.map((data) => data.bpm),
        borderColor: "rgba(153, 102, 255, 1)",
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        pointBackgroundColor: "purple",
        pointBorderColor: "white",
        pointRadius: 5,
        tension: 0.4,
      },
    ],
  };

  // Options for all charts with futuristic styling
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: { color: "#E0E0E0", font: { weight: "600" } },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        titleFont: { size: 14, weight: "bold" },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 5,
      },
    },
    scales: {
      x: {
        ticks: { color: "#E0E0E0" },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
      y: {
        ticks: { color: "#E0E0E0" },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
    },
  };

  // Data for Acceleration Magnitude Line Chart
  const accelLineData = {
    labels: timestamps,
    datasets: [
      {
        label: "Acceleration Magnitude",
        data: accelMagnitude,
        borderColor: "rgba(0, 255, 255, 1)",
        backgroundColor: "rgba(0, 255, 255, 0.2)",
        pointBackgroundColor: "#00FFFF",
        pointBorderColor: "white",
        pointRadius: 5,
        tension: 0.4,
      },
    ],
  };

  // Data for Gyroscope Magnitude Bar Chart
  const gyroBarData = {
    labels: timestamps,
    datasets: [
      {
        label: "Gyroscope Magnitude",
        data: gyroMagnitude,
        backgroundColor: "rgba(255, 0, 150, 0.5)",
        borderColor: "rgba(255, 0, 150, 1)",
        borderWidth: 1,
      },
    ],
  };

  // Doughnut chart for average distribution of magnitude features
  const doughnutData = {
    labels: ["Avg Acc Mag", "Avg Gyro Mag"],
    datasets: [
      {
        data: [avgAccelMag, avgGyroMag],
        backgroundColor: ["rgba(0, 255, 255, 0.7)", "rgba(255, 0, 150, 0.7)"],
        borderColor: ["#00FFFF", "#FF0096"],
        borderWidth: 2,
      },
    ],
  };

  // Futuristic dashboard card style
  const cardStyle = {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    padding: "20px",
    margin: "10px",
    flex: 1,
    textAlign: "center",
    color: "#E0E0E0",
    boxShadow: "0 0 15px rgba(0,255,255,0.2)",
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: "linear-gradient(135deg, #0F2027, #203A43, #2C5364)", minHeight: "100vh", padding: "20px" }}>
      <header style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1 style={{ color: "#E0E0E0", fontSize: "2.5rem", textShadow: "2px 2px 8px #00FFFF" }}>Fall Monitoring Dashboard</h1>
        <p style={{ color: "#A0A0A0", fontSize: "1.1rem" }}>Live data visualization and detailed analytics</p>
      </header>

      {/* Main Metric Cards */}
      <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", marginBottom: "30px" }}>
        <div style={cardStyle}>
          <h2>Avg Acc X</h2>
          <p style={{ fontSize: "2rem", margin: "10px 0" }}>{avgAcX}</p>
        </div>
        <div style={cardStyle}>
          <h2>Avg Acc Y</h2>
          <p style={{ fontSize: "2rem", margin: "10px 0" }}>{avgAcY}</p>
        </div>
        <div style={cardStyle}>
          <h2>Avg Acc Z</h2>
          <p style={{ fontSize: "2rem", margin: "10px 0" }}>{avgAcZ}</p>
        </div>
        <div style={cardStyle}>
          <h2>Latest BPM</h2>
          <p style={{ fontSize: "2rem", margin: "10px 0" }}>{latestBpm}</p>
        </div>
      </div>

      {/* Main Line Chart */}
      <div style={{ width: "100%", maxWidth: "1300px", height: "500px", margin: "0 auto", backgroundColor: "#1F1F1F", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,255,255,0.3)" }}>
        <Line data={mainChartData} options={chartOptions} />
      </div>

      {/* Additional Visualizations Section */}
      <section style={{ marginTop: "40px", textAlign: "center", color: "#E0E0E0" }}>
        <h2 style={{ textShadow: "1px 1px 5px #00FFFF" }}>Additional Visualizations</h2>
        <p>New computed metrics and analytics from incoming sensor data.</p>

        {/* Computed Metrics Cards */}
        <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", margin: "30px 0" }}>
          <div style={cardStyle}>
            <h3>Acceleration Magnitude</h3>
            <p style={{ fontSize: "2rem", margin: "10px 0" }}>{avgAccelMag}</p>
          </div>
          <div style={cardStyle}>
            <h3>Gyroscope Magnitude</h3>
            <p style={{ fontSize: "2rem", margin: "10px 0" }}>{avgGyroMag}</p>
          </div>
        </div>

        {/* Computed Visualizations */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
          {/* Acceleration Magnitude Line Chart */}
          <div style={{ width: "500px", height: "300px", margin: "10px", background: "#1F1F1F", padding: "15px", borderRadius: "10px", boxShadow: "0 4px 15px rgba(0,255,255,0.3)" }}>
            <Line data={accelLineData} options={chartOptions} />
          </div>
          {/* Gyroscope Magnitude Bar Chart */}
          <div style={{ width: "500px", height: "300px", margin: "10px", background: "#1F1F1F", padding: "15px", borderRadius: "10px", boxShadow: "0 4px 15px rgba(255,0,150,0.3)" }}>
            <Bar data={gyroBarData} options={chartOptions} />
          </div>
          {/* Doughnut Chart for Average Distribution */}
          <div style={{ width: "300px", height: "300px", margin: "10px", background: "#1F1F1F", padding: "15px", borderRadius: "10px", boxShadow: "0 4px 15px rgba(0,255,255,0.3)" }}>
            <Doughnut data={doughnutData} options={chartOptions} />
          </div>
        </div>
      </section>

      {/* Advanced Data and Features Section */}
      <section style={{ marginTop: "40px", textAlign: "center", color: "#E0E0E0" }}>
        <h2 style={{ textShadow: "1px 1px 5px #00FFFF" }}>Latest Data & Advanced Features</h2>
        
        {sensorData.length > 0 && (
          <div style={{ margin: "20px auto", maxWidth: "1300px", textAlign: "left" }}>
            {/* Latest Data Entry */}
            <h3>Latest Sensor Data Entry</h3>
            <pre style={{ backgroundColor: "#1F1F1F", padding: "15px", borderRadius: "10px", color: "#E0E0E0" }}>
              {JSON.stringify(sensorData[sensorData.length - 1], null, 2)}
            </pre>

            {/* Advanced Features for Accelerometer X */}
            <h3>Accelerometer X Statistical Features</h3>
            <p>
              Mean: {accelXStats.mean} | Std: {accelXStats.std} | Min: {accelXStats.min} | Max: {accelXStats.max} | Range: {accelXStats.range} | RMS: {accelXStats.rms} | IQR: {accelXStats.iqr}
            </p>

            <h3>Accelerometer X Time-Series Features</h3>
            <p>
              Cumulative Sum: {timeSeriesAccelX.cumulativeSum} | Zero Crossings: {timeSeriesAccelX.zeroCrossings} | Entropy: {timeSeriesAccelX.entropy}
            </p>

            <h3>Accelerometer X Frequency-Domain Features</h3>
            <p>
              Peak: {fftAccelX.peak} | Spectral Energy: {fftAccelX.spectralEnergy} | Dominant Frequency: {fftAccelX.dominantFrequency}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default App;
