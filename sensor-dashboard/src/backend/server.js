import express from "express";
import mysql from "mysql";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "sensor_db",
});

db.connect((err) => {
  if (err) {
    console.error("MySQL connection error:", err);
    return;
  }
  console.log("✅ Connected to MySQL Database");
});

// Root Route to Avoid "Cannot GET /"
app.get("/", (req, res) => {
  res.send("Welcome to the Sensor Data API!");
});

// API Route to Fetch Sensor Data
app.get("/api/sensor", (req, res) => {
  db.query("SELECT * FROM sensordata1 ORDER BY DATETIME DESC LIMIT 1", (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json(result[0]);
  });
});

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
