Timely and accurate detection of falls is critical to ensuring rapid response and minimizing the risk of
serious injury among elderly individuals. Continuous remote monitoring during daily activities enables swift
intervention in the event of a fall and supports effective care for individuals with balance impairments.This
research presents a deep learning framework for accurate fall detection using data collected from
a custom-built wrist wearable device. A total of 4 young participants were a part of this study. A
comprehensive experiment including twelve types of activities (6 types of falls and 6 types of ADLs) was
designed based on previously done studies. The proposed methodology integrated Multi-sensor data,
including accelerometer, gyroscope, and heart rate measurements collected by an ESP32-based Iot
device, and applies a robust feature extraction process to build a manually labeled dataset. An artificial
neural network (ANN) is trained using statistical, time-series, and frequency-domain features, enabling
it to effectively differentiate between fall and non-fall events even under varying movement conditions.
Experimental evaluations show that the system achieves competitive accuracy of 96% with relatively small
amounts of data, making it an efficient solution for continuous remote health monitoring. Additionally, by
combining acceleration and angular velocity and bpm data the trained model showed better performance
than each model of acceleration, angular velocity and bpm separately. The approach demonstrates a
significant reduction in false alarms compared to traditional methods, supporting its potential integration
into comprehensive health monitoring and emergency response frameworks.
