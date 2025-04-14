#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include "config.h"

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* mqtt_server = MQTT_SERVER;
const int mqtt_port = MQTT_PORT;
const char* topic = MQTT_TOPIC;

// Biến lưu giá trị cảm biến
float temperature = 0;
float humidity = 0;
int gasValue = 0;
String payload = "";
bool isGasAlarm = false;       // Biến đánh dấu báo động do khí gas
bool isTempAlarm = false;      // Biến đánh dấu báo động do nhiệt độ

// Biến cho cơ chế buzzer bíp bíp không chặn
unsigned long lastBuzzerChangeTime = 0;  // Thời gian thay đổi trạng thái còi gần nhất
int buzzerState = LOW;              // Trạng thái hiện tại của còi
int buzzerBeepCount = 0;            // Số lần bíp đã hoàn thành
bool isBuzzerActive = false;        // Còi đang hoạt động hay không
int buzzerBeepInterval = 200;       // Khoảng thời gian mỗi trạng thái (ms)

// Biến cho cơ chế LED nhấp nháy không chặn
unsigned long lastLedChangeTime = 0;   // Thời gian thay đổi trạng thái LED gần nhất
int ledState = HIGH;                // Trạng thái hiện tại của LED (mặc định là HIGH - sáng)
bool isLedBlinking = false;         // LED đang ở chế độ nhấp nháy hay không
int ledBlinkInterval = 200;         // Khoảng thời gian nhấp nháy LED (ms)

// Biến cho nút nhấn
bool buttonState = HIGH;           // Trạng thái hiện tại của nút nhấn (HIGH = không nhấn, LOW = nhấn)
bool lastButtonState = HIGH;       // Trạng thái trước đó của nút nhấn
unsigned long lastDebounceTime = 0;  // Thời điểm cuối cùng nút nhấn được bấm
unsigned long debounceDelay = 50;    // Thời gian debounce (ms)
bool manualOverride = false;       // Biến để ghi nhớ việc người dùng đã tắt còi thủ công

// Create an instance of the DHT class
DHT dht(DHTPIN, DHTTYPE);

// Create an instance of the WiFiClient and PubSubClient
WiFiClient espClient;
PubSubClient client(espClient);

// Connect to the WiFi network
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
}

// Reconnect to the MQTT server if the connection is lost
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP8266Client")) {
      Serial.println("connected");
      // Subscribe to topics if needed
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// Đọc dữ liệu từ cảm biến DHT11
void readDHTSensor() {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  
  // Kiểm tra nếu đọc thất bại
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    temperature = 0;
    humidity = 0;
  }
}

// Đọc dữ liệu từ cảm biến khí gas MQ-2
void readGasSensor() {
  gasValue = analogRead(MQ2_PIN);
}

// Kiểm tra giá trị khí gas và kích hoạt còi buzzer nếu vượt ngưỡng
void checkGasThreshold() {
  if (gasValue > GAS_THRESHOLD && !manualOverride) {
    isGasAlarm = true;
    startBuzzer();
    startLedBlinking();  // Bắt đầu nhấp nháy LED khi có báo động
    Serial.println("WARNING: Gas level exceeds threshold!");
  } else if (gasValue <= GAS_THRESHOLD) {
    isGasAlarm = false;
    // Chỉ dừng cảnh báo nếu không có báo động nhiệt độ
    if (!isTempAlarm) {
      stopBuzzer();
      stopLedBlinking();  // Dừng nhấp nháy LED khi trở về trạng thái bình thường
      
      // Reset manual override khi không có báo động nào
      if (manualOverride) {
        manualOverride = false;
        Serial.println("All sensors normal, reset manual override");
      }
    }
  }
}

// Kiểm tra nhiệt độ và kích hoạt cảnh báo nếu vượt ngưỡng
void checkTempThreshold() {
  if (temperature >= TEMP_THRESHOLD && !manualOverride) {
    isTempAlarm = true;
    startBuzzer();
    startLedBlinking();  // Bắt đầu nhấp nháy LED khi có báo động
    Serial.println("WARNING: Temperature exceeds threshold!");
  } else if (temperature <= TEMP_THRESHOLD) {
    isTempAlarm = false;
    // Chỉ dừng cảnh báo nếu không có báo động khí gas
    if (!isGasAlarm) {
      stopBuzzer();
      stopLedBlinking();  // Dừng nhấp nháy LED khi trở về trạng thái bình thường
      
      // Reset manual override khi không có báo động nào
      if (manualOverride) {
        manualOverride = false;
        Serial.println("All sensors normal, reset manual override");
      }
    }
  }
}

// Kích hoạt cơ chế bíp bíp của còi
void startBuzzer() {
  if (!isBuzzerActive) {
    isBuzzerActive = true;
    buzzerBeepCount = 0;
    buzzerState = HIGH;
    digitalWrite(BUZZER_PIN, buzzerState);
    lastBuzzerChangeTime = millis();
    Serial.println("Buzzer activated");
  }
}

// Dừng hoạt động của còi
void stopBuzzer() {
  if (isBuzzerActive) {
    isBuzzerActive = false;
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("Buzzer deactivated");
  }
}

// Kích hoạt chế độ nhấp nháy cho LED
void startLedBlinking() {
  if (!isLedBlinking) {
    isLedBlinking = true;
    ledState = LOW;  // Bắt đầu với LED tắt để tạo sự tương phản
    digitalWrite(LED_ALARM_PIN, ledState);
    lastLedChangeTime = millis();
    Serial.println("LED alarm blinking started");
  }
}

// Dừng chế độ nhấp nháy và đặt LED về trạng thái sáng bình thường
void stopLedBlinking() {
  if (isLedBlinking) {
    isLedBlinking = false;
    ledState = HIGH;  // Đặt LED về trạng thái luôn sáng bình thường
    digitalWrite(LED_ALARM_PIN, ledState);
    Serial.println("LED alarm back to normal state");
  }
}

// Cập nhật trạng thái còi buzzer (gọi trong vòng lặp chính)
void updateBuzzer() {
  if (isBuzzerActive) {
    unsigned long currentTime = millis();
    
    // Kiểm tra nếu đã đến lúc thay đổi trạng thái còi
    if (currentTime - lastBuzzerChangeTime >= buzzerBeepInterval) {
      lastBuzzerChangeTime = currentTime;
      
      // Đảo trạng thái còi (ON-OFF-ON-OFF...)
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState);
      
      // Nếu vừa tắt còi (kết thúc một tiếng bíp)
      if (buzzerState == LOW) {
        buzzerBeepCount++;
        
        // Sau 3 tiếng bíp, dừng một chút rồi lặp lại
        if (buzzerBeepCount >= 3) {
          buzzerBeepCount = 0;
          buzzerBeepInterval = 800;  // Khoảng nghỉ dài hơn sau 3 tiếng bíp
        } else {
          buzzerBeepInterval = 200;  // Khoảng thời gian giữa các tiếng bíp
        }
      } else {
        // Thời gian phát tiếng bíp
        buzzerBeepInterval = 200;
      }
    }
  }
}

// Cập nhật trạng thái LED báo động (gọi trong vòng lặp chính)
void updateLed() {
  // Nếu LED không ở chế độ nhấp nháy, đảm bảo nó luôn sáng
  if (!isLedBlinking) {
    if (ledState != HIGH) {
      ledState = HIGH;
      digitalWrite(LED_ALARM_PIN, ledState);
    }
    return;
  }
  
  // Xử lý nhấp nháy nếu đang ở chế độ cảnh báo
  unsigned long currentTime = millis();
  
  // Kiểm tra nếu đã đến lúc thay đổi trạng thái LED
  if (currentTime - lastLedChangeTime >= ledBlinkInterval) {
    lastLedChangeTime = currentTime;
    
    // Đảo trạng thái LED (ON-OFF-ON-OFF...)
    ledState = !ledState;
    digitalWrite(LED_ALARM_PIN, ledState);
  }
}

// Xử lý nút nhấn với debounce để tránh nhiễu
void handleButton() {
  // Đọc trạng thái nút nhấn hiện tại
  int reading = digitalRead(BUTTON_PIN);

  // Kiểm tra xem nút có thay đổi trạng thái không
  if (reading != lastButtonState) {
    // Cập nhật thời gian debounce
    lastDebounceTime = millis();
  }

  // Kiểm tra nếu đã qua đủ thời gian debounce và trạng thái nút đã ổn định
  if ((millis() - lastDebounceTime) > debounceDelay) {
    // Nếu trạng thái đã ổn định và khác với buttonState hiện tại
    if (reading != buttonState) {
      buttonState = reading;

      // Nếu nút được nhấn (LOW), tắt còi và dừng nhấp nháy LED
      if (buttonState == LOW) {
        if (isBuzzerActive) {
          stopBuzzer();
          stopLedBlinking();  // Dừng nhấp nháy LED khi tắt chuông báo động thủ công
          manualOverride = true;
          Serial.println("Alarm manually deactivated by button press");
        }
      }
    }
  }

  // Lưu lại trạng thái hiện tại để so sánh trong lần lặp tiếp theo
  lastButtonState = reading;
}

// Tạo payload JSON từ dữ liệu cảm biến để gửi lên MQTT
void createPayload() {
  payload = "{";
  payload += "\"type\": \"ESP8266\", ";
  payload += "\"temperature\": " + String(temperature, 1) + ", ";
  payload += "\"humidity\": " + String(humidity, 1) + ", ";
  payload += "\"gas_volume\": " + String(gasValue) + ", ";
  payload += "\"alarm_overridden\": " + String(manualOverride ? "true" : "false") + ", ";
  payload += "\"alarm_active\": " + String(isLedBlinking ? "true" : "false") + ", ";
  payload += "\"gas_alarm\": " + String(isGasAlarm ? "true" : "false") + ", ";
  payload += "\"temp_alarm\": " + String(isTempAlarm ? "true" : "false");
  payload += "}";
  
  Serial.print("Payload: ");
  Serial.println(payload);
}

// Gửi dữ liệu lên MQTT server
void publishData() {
  if (client.connected()) {
    client.publish(topic, payload.c_str());
    Serial.println("Data published to MQTT server");
  } else {
    Serial.println("Failed to publish: MQTT not connected");
  }
}

void setup() {
  Serial.begin(115200);
  
  // Cấu hình các chân GPIO
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);  // Đảm bảo còi tắt khi khởi động
  
  // Cấu hình LED cảnh báo
  pinMode(LED_ALARM_PIN, OUTPUT);
  digitalWrite(LED_ALARM_PIN, HIGH);  // LED luôn sáng ở chế độ bình thường
  
  // Cấu hình nút nhấn với điện trở pull-up nội
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  // Initialize the DHT sensor
  dht.begin();
  
  Serial.println("System ready");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Xử lý nút nhấn
  handleButton();

  // Cập nhật trạng thái còi buzzer và LED
  updateBuzzer();
  updateLed();

  // Đọc giá trị từ các cảm biến
  readDHTSensor();
  readGasSensor();
  
  // Kiểm tra ngưỡng khí gas, nhiệt độ và điều khiển thiết bị cảnh báo
  checkGasThreshold();
  checkTempThreshold();
  
  // Tạo payload và gửi dữ liệu
  createPayload();
  publishData();

  delay(1000);  // Đọc và gửi dữ liệu mỗi 1 giây
}