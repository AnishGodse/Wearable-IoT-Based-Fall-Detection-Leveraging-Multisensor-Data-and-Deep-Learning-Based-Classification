from flask import Flask, request, jsonify
import joblib
import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model
from scipy.stats import entropy, iqr, skew, kurtosis
from scipy.signal import welch
from scipy.fftpack import fft

app = Flask(__name__)

# Load the trained ANN model and scaler
model = load_model("ann_model_improved.keras")
scaler = joblib.load("scaler.pkl")

# Define sensor columns and batch size
sensor_columns = ["AcX", "AcY", "AcZ", "GyX", "GyY", "GyZ"]
batch_size = 21

def extract_features_from_batch(batch_df):
    features = {}
    for col in sensor_columns:
        data = batch_df[col].values
        features[f"{col}_mean"] = np.mean(data)
        features[f"{col}_std"] = np.std(data)
        features[f"{col}_min"] = np.min(data)
        features[f"{col}_max"] = np.max(data)
        features[f"{col}_range"] = np.ptp(data)
        features[f"{col}_iqr"] = iqr(data)
        features[f"{col}_rms"] = np.sqrt(np.mean(np.square(data)))
        features[f"{col}_skew"] = skew(data)
        features[f"{col}_kurtosis"] = kurtosis(data)
        features[f"{col}_cumsum"] = np.sum(np.cumsum(data))
        features[f"{col}_zero_crossing"] = np.sum(np.diff(np.sign(data)) != 0)
        features[f"{col}_entropy"] = entropy(np.histogram(data, bins=10)[0] + 1)
        fft_values = np.abs(fft(data))
        features[f"{col}_fft_peak"] = np.max(fft_values)
        freqs, psd = welch(data, nperseg=min(batch_size, len(data)))
        features[f"{col}_spectral_energy"] = np.sum(psd)
        features[f"{col}_dominant_freq"] = freqs[np.argmax(psd)] if len(freqs) > 0 else 0
    # Combined magnitude features
    acc_mag = np.sqrt(batch_df["AcX"]**2 + batch_df["AcY"]**2 + batch_df["AcZ"]**2)
    gyro_mag = np.sqrt(batch_df["GyX"]**2 + batch_df["GyY"]**2 + batch_df["GyZ"]**2)
    features["acc_mag_mean"] = np.mean(acc_mag)
    features["acc_mag_std"] = np.std(acc_mag)
    features["gyro_mag_mean"] = np.mean(gyro_mag)
    features["gyro_mag_std"] = np.std(gyro_mag)
    return features

@app.route('/predict', methods=['POST'])
def predict():
    # Expecting JSON with a "data" field that is an array of sensor readings.
    # Each reading should be a dictionary with keys: AcX, AcY, AcZ, GyX, GyY, GyZ.
    json_data = request.get_json()
    data = json_data.get("data", None)
    if data is None:
        return jsonify({"error": "No sensor data provided"}), 400

    # Convert input data to DataFrame
    df_data = pd.DataFrame(data)

    # Check if there are enough rows to form one batch
    if len(df_data) < batch_size:
        return jsonify({"error": "Insufficient data to form a batch"}), 400

    # For simplicity, use the first 21 rows as one batch.
    batch_df = df_data.iloc[0:batch_size]
    features = extract_features_from_batch(batch_df)
    features_df = pd.DataFrame([features])
    
    # Ensure the features are in the same order as expected by the scaler
    features_df = features_df[scaler.feature_names_in_]
    
    # Scale features
    X_scaled = scaler.transform(features_df)
    
    # Predict using the ANN model
    predicted_prob = model.predict(X_scaled)
    predicted_label = int((predicted_prob > 0.5).astype(int)[0][0])
    
    return jsonify({
        "predicted_label": predicted_label,
        "predicted_probability": float(predicted_prob[0][0])
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)