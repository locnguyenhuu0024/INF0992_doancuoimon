// MQTT Configuration
#define MQTT_SERVER "your_mqtt_server_ip"  // Replace with your MQTT broker IP address
#define MQTT_PORT 1884                     // MQTT broker port (default: 1883)
#define MQTT_USER ""                       // MQTT username (if required)
#define MQTT_PASSWORD ""                   // MQTT password (if required)
#define MQTT_TOPIC "esp8266/sensor_data"   // MQTT topic for publishing sensor data

// WiFi Configuration
#define WIFI_SSID "your_wifi_ssid"         // Replace with your WiFi network name
#define WIFI_PASSWORD "your_wifi_password" // Replace with your WiFi password

// Sensor Pin Configuration
#define DHTPIN D5                          // Digital pin connected to the DHT11 sensor
#define DHTTYPE DHT11                      // Type of DHT sensor (DHT11 or DHT22)
#define MQ2_PIN A0                         // Analog pin connected to MQ-2 gas sensor
#define BUZZER_PIN D7                      // Digital pin connected to buzzer
#define BUTTON_PIN D6                      // Digital pin connected to alarm mute button
#define LED_ALARM_PIN D8                   // Digital pin connected to alarm LED

// Threshold Values
#define GAS_THRESHOLD 400                  // Gas concentration threshold for alarm (adjust as needed)
#define TEMP_THRESHOLD 45.0                // Temperature threshold for alarm (in Celsius) 