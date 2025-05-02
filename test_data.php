<?php
$hostname = "localhost";
$username = "root";
$password = "";
$database = "sensor_db";
$conn = mysqli_connect($hostname, $username, $password, $database);
if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}
echo "Database connection is OK<br>";

// Check if receiving batch data
if(isset($_POST["batch_data"])) {
    $batchData = json_decode($_POST["batch_data"], true);
    
    if(is_array($batchData)) {
        $successCount = 0;
        $errorCount = 0;
        
        // Prepare the SQL statement once
        $stmt = mysqli_prepare($conn, "INSERT INTO sensordata1 (AcX, AcY, AcZ, GyX, GyY, GyZ, bpm, DATETIME) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        
        if($stmt) {
            mysqli_stmt_bind_param($stmt, "iiiiiiis", $AcX, $AcY, $AcZ, $GyX, $GyY, $GyZ, $bpm, $timestamp);
            
            // Process each data point in the batch
            foreach($batchData as $data) {
                // Extract values
                $AcX = $data["AcX"];
                $AcY = $data["AcY"];
                $AcZ = $data["AcZ"];
                $GyX = $data["GcX"];
                $GyY = $data["GcY"];
                $GyZ = $data["GcZ"];
                $bpm = $data["bpm"];
                $timestamp = $data["timestamp"];
                
                // Execute the prepared statement
                if(mysqli_stmt_execute($stmt)) {
                    $successCount++;
                } else {
                    $errorCount++;
                }
            }
            
            mysqli_stmt_close($stmt);
            echo "Batch processing complete. Successful: $successCount, Failed: $errorCount";
        } else {
            echo "Error preparing statement: " . mysqli_error($conn);
        }
    } else {
        echo "Invalid batch data format";
    }
}
// Handle single record case (backward compatibility)
else if(isset($_POST["AcX"]) && isset($_POST["AcY"]) && isset($_POST["AcZ"]) && 
   isset($_POST["GcX"]) && isset($_POST["GcY"]) && isset($_POST["GcZ"]) && 
   isset($_POST["bpm"]) && isset($_POST["timestamp"])){
    
    $AcX = $_POST["AcX"];
    $AcY = $_POST["AcY"];
    $AcZ = $_POST["AcZ"]; 
    $GcX = $_POST["GcX"];
    $GcY = $_POST["GcY"];
    $GcZ = $_POST["GcZ"];
    $bpm = $_POST["bpm"];
    $timestamp = $_POST["timestamp"];
    
    // Prepare SQL statement to prevent SQL injection
    $sql = "INSERT INTO sensordata1 (AcX, AcY, AcZ, GyX, GyY, GyZ, bpm, DATETIME) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = mysqli_prepare($conn, $sql);
    
    if ($stmt) {
        mysqli_stmt_bind_param($stmt, "iiiiiiis", $AcX, $AcY, $AcZ, $GcX, $GcY, $GcZ, $bpm, $timestamp);
        
        if (mysqli_stmt_execute($stmt)) {
            echo "\nNew record created successfully";
        } else {
            echo "Error: " . mysqli_stmt_error($stmt);
        }
        
        mysqli_stmt_close($stmt);
    } else {
        echo "Error: " . mysqli_error($conn);
    }
} else {
    echo "Required data not provided";
}

mysqli_close($conn);
?>