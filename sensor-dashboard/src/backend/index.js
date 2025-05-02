import express from "express";
import mysql from "mysql";
import cors from "cors";
import axios from "axios";  // Import Axios for calling Flask API

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "sensor_db",
});

db.connect((err) => {
  if (err) {
    console.error("MySQL connection error:", err);
    return;
  }
  console.log("✅ Connected to MySQL Database");
});

// Fetch latest sensor data
app.get("/api/sensor", async (req, res) => {
  db.query("SELECT * FROM sensordata1 ORDER BY DATETIME DESC LIMIT 1", async (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "Database error" });
      return;
    }

    const sensorData = result[0];

    // Send data to Flask ML API for prediction
    try {
      const response = await axios.post("http://127.0.0.1:5001/predict", {
        AcX: sensorData.AcX,
        AcY: sensorData.AcY,
        AcZ: sensorData.AcZ,
        GyX: sensorData.GyX,
        GyY: sensorData.GyY,
        GyZ: sensorData.GyZ,
        bpm: sensorData.bpm
      });

      // Combine MySQL data with prediction
      res.json({ ...sensorData, prediction: response.data.prediction });
    } catch (error) {
      console.error("Error calling ML API:", error);
      res.status(500).json({ error: "ML API error" });
    }
  });
});

app.listen(5000, () => {
  console.log("🚀 Server running on port 5005");
});
