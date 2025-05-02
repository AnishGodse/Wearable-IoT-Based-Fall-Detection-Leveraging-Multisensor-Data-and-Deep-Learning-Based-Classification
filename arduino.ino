#include <MAX3010x.h>
#include "filters.h"
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "time.h"

// WiFi Setup
const char* ssid = "Anish's Nothing 2a"; 
const char* password = "virus123"; 
String URL = "http://192.168.188.103/sensordata1/test_data.php";

// NTP Server Settings
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 19800;     // Mumbai timezone: GMT+5:30 (5*3600 + 30*60 = 19800 seconds)
const int   daylightOffset_sec = 0;    // India doesn't observe Daylight Saving Time

// MAX30102 Setup
MAX30105 sensor;
const auto kSamplingRate = sensor.SAMPLING_RATE_400SPS;
const float kSamplingFrequency = 400.0;

const unsigned long kFingerThreshold = 5000;  
const unsigned int kFingerCooldownMs = 500;
const float kEdgeThreshold = -1000.0;  
const float kLowPassCutoff = 5.0;
const float kHighPassCutoff = 0.5;
const bool kEnableAveraging = false;
const int kAveragingSamples = 5;
const int kSampleThreshold = 5;

LowPassFilter low_pass_filter_red(kLowPassCutoff, kSamplingFrequency);
HighPassFilter high_pass_filter(kHighPassCutoff, kSamplingFrequency);
Differentiator differentiator(kSamplingFrequency);
MovingAverageFilter<kAveragingSamples> averager_bpm;

long last_heartbeat = 0;
long crossed_time = 0;
bool crossed = false;
float last_diff = NAN;
int bpm = 0;  // Store the last known BPM value

// MPU6050 Setup
const int MPU_ADDR = 0x68;
int16_t AcX, AcY, AcZ, GyX, GyY, GyZ;

// Timing for HTTP requests
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 100; // Send data every 100ms (10 times per second)

// For batching data
const int MAX_BATCH_SIZE = 10;
int batchCount = 0;

typedef struct {
    int16_t AcX, AcY, AcZ, GyX, GyY, GyZ;
    int bpm;
    char timestamp[30];
} SensorData;

SensorData dataPoints[MAX_BATCH_SIZE];

void setup() {
  Serial.begin(115200);
  
  // Initialize MAX30102
  if (sensor.begin() && sensor.setSamplingRate(kSamplingRate)) {
    Serial.println("MAX30102 sensor initialized");
  } else {
    Serial.println("MAX30102 sensor not found");
    while (1);
  }

  // Initialize MPU6050
  Wire.begin(25, 26, 100000);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);
  Serial.println("MPU6050 initialized");
  
  // Connect to WiFi
  connectWiFi();
  
  // Initialize time with Mumbai timezone
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("NTP time synced with Mumbai timezone (GMT+5:30)");
  
  // Print current time to verify
  printLocalTime();
}

void loop() {
  // Check WiFi connection
  if(WiFi.status() != WL_CONNECTED) { 
    connectWiFi();
  }
  
  // Read MPU6050 data
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(true);
  Wire.requestFrom(MPU_ADDR, 14, true);
  AcX = Wire.read() << 8 | Wire.read();
  AcY = Wire.read() << 8 | Wire.read();
  AcZ = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();  // Skip temperature
  GyX = Wire.read() << 8 | Wire.read();
  GyY = Wire.read() << 8 | Wire.read();
  GyZ = Wire.read() << 8 | Wire.read();

  // Read MAX30102 data
  auto sample = sensor.readSample(500);
  float current_value_red = low_pass_filter_red.process(sample.red);
  float current_value = high_pass_filter.process(current_value_red);
  float current_diff = differentiator.process(current_value);

  if (last_diff > 0 && current_diff < 0) {
    crossed = true;
    crossed_time = millis();
  }

  if (crossed && current_diff < kEdgeThreshold) {
    if (last_heartbeat != 0 && crossed_time - last_heartbeat > 300) {
      int new_bpm = 60000 / (crossed_time - last_heartbeat);
      if (new_bpm > 50 && new_bpm < 250) {
        if (kEnableAveraging) {
          bpm = averager_bpm.process(new_bpm);
          if (averager_bpm.count() >= kSampleThreshold) {
            bpm = bpm;
          }
        } else {
          bpm = new_bpm;
        }
      }
    }
    last_heartbeat = crossed_time;
  }
  last_diff = current_diff;

  // Print data in CSV format: AcX, AcY, AcZ, GyX, GyY, GyZ, BPM
  Serial.print(AcX); Serial.print(",");
  Serial.print(AcY); Serial.print(",");
  Serial.print(AcZ); Serial.print(",");
  Serial.print(GyX); Serial.print(",");
  Serial.print(GyY); Serial.print(",");
  Serial.print(GyZ); Serial.print(",");
  Serial.println(bpm);

  // Collect sensor data at regular intervals
  unsigned long currentTime = millis();
  if (currentTime - lastSendTime >= sendInterval) {
    lastSendTime = currentTime;
    collectDataPoint();
    
    // When batch is full, send all data
    if (batchCount >= MAX_BATCH_SIZE) {
      sendBatchData();
      batchCount = 0;
    }
  }

  delay(10);  // Shorter delay for faster processing
}

void printLocalTime() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){
    Serial.println("Failed to obtain time");
    return;
  }
  Serial.println(&timeinfo, "Current Mumbai Time: %Y-%m-%d %H:%M:%S");
}

void collectDataPoint() {
  // Get current timestamp
  struct tm timeinfo;
  
  if(!getLocalTime(&timeinfo)){
    Serial.println("Failed to obtain time");
    strcpy(dataPoints[batchCount].timestamp, "0000-00-00 00:00:00.000");
  } else {
    // Format timestamp as YYYY-MM-DD HH:MM:SS.mmm
    sprintf(dataPoints[batchCount].timestamp, "%04d-%02d-%02d %02d:%02d:%02d.%03d",
            timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
            timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec,
            millis() % 1000); // Adding milliseconds
  }
  
  // Store data in the batch array
  dataPoints[batchCount].AcX = AcX;
  dataPoints[batchCount].AcY = AcY;
  dataPoints[batchCount].AcZ = AcZ;
  dataPoints[batchCount].GyX = GyX;
  dataPoints[batchCount].GyY = GyY;
  dataPoints[batchCount].GyZ = GyZ;
  dataPoints[batchCount].bpm = bpm;
  
  batchCount++;
}

void sendBatchData() {
  if (batchCount == 0) return;
  
  String postData = "batch_data=";
  
  // Build JSON array of data
  postData += "[";
  for (int i = 0; i < batchCount; i++) {
    if (i > 0) postData += ",";
    postData += "{\"AcX\":" + String(dataPoints[i].AcX) +
               ",\"AcY\":" + String(dataPoints[i].AcY) +
               ",\"AcZ\":" + String(dataPoints[i].AcZ) +
               ",\"GcX\":" + String(dataPoints[i].GyX) +
               ",\"GcY\":" + String(dataPoints[i].GyY) +
               ",\"GcZ\":" + String(dataPoints[i].GyZ) +
               ",\"bpm\":" + String(dataPoints[i].bpm) +
               ",\"timestamp\":\"" + String(dataPoints[i].timestamp) + "\"}";
  }
  postData += "]";

  HTTPClient http; 
  http.begin(URL);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  
  int httpCode = http.POST(postData); 
  String payload = http.getString(); 
  
  Serial.print("URL: "); Serial.println(URL); 
  Serial.print("Batch Size: "); Serial.println(batchCount);
  Serial.print("httpCode: "); Serial.println(httpCode); 
  Serial.print("payload: "); Serial.println(payload); 
  Serial.println("--------------------------------------------------");
  
  http.end();
}

void connectWiFi() {
  WiFi.mode(WIFI_OFF);
  delay(1000);
  // This line hides the viewing of ESP as wifi hotspot
  WiFi.mode(WIFI_STA);
  
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
    
  Serial.print("connected to : "); Serial.println(ssid);
  Serial.print("IP address: "); Serial.println(WiFi.localIP());
}
