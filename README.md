# HỆ THỐNG GIÁM SÁT KHÍ GAS & NHIỆT ĐỘ

Hệ thống IoT giám sát khí gas và nhiệt độ, kết hợp cảnh báo qua Telegram khi phát hiện rò rỉ khí gas, nhiệt độ cao, hoặc nguy cơ cháy nổ.

## Thành viên nhóm

- Nguyễn Hữu Lộc - MSSV: 18050078
- Quách Tú Trinh - MSSV: 20050077

## Yêu cầu hệ thống

- VS Code
- Docker và Docker Compose
- Node.js (để phát triển)
- Tài khoản Telegram và Bot Token
- NodeMCU ESP8266
- Cảm biến DHT11 (nhiệt độ & độ ẩm)
- Cảm biến MQ-2 (khí gas)

## Cấu hình

### 1. Cấu hình Telegram Bot

Để nhận được cảnh báo qua Telegram, bạn cần thiết lập Bot Telegram:

1. Tạo bot Telegram mới bằng cách nhắn tin cho [@BotFather](https://t.me/BotFather) trên Telegram
2. Gõ `/newbot` và làm theo hướng dẫn để tạo bot mới
3. Nhận Bot Token từ BotFather (giống như: `123456789:ABCdefGhIJKlmnOPQRstUVwxYZ`)
4. Thêm bot vào nhóm hoặc chat trực tiếp với bot
5. Lấy Chat ID của bạn hoặc của nhóm:
   - Gửi tin nhắn cho bot của bạn
   - Mở URL: `https://api.telegram.org/botYOUR_BOT_TOKEN_HERE/getUpdates`
   - Tìm `"chat":{"id":XXXXXXXXX}` trong kết quả JSON

### 2. Cấu hình Backend (.env)

1. Tạo file `.env` trong thư mục `nodejs-app` bằng cách sao chép từ file `example.env`:

```bash
cd nodejs-app
cp example.env .env
```

2. Chỉnh sửa file `.env` với thông tin của bạn:

```
# Cấu hình Telegram (thay thế giá trị mẫu với thông tin thực của bạn)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Các cài đặt khác (có thể tùy chỉnh)
GAS_THRESHOLD=400
TEMP_THRESHOLD=45
TELEGRAM_REPORT_INTERVAL=300000
```

### 3. Cấu hình NodeMCU (config.h)

1. Tạo file `config.h` trong thư mục `nodemcu/publisher` bằng cách sao chép từ file `config.h.example`:

```bash
cd nodemcu/publisher
cp config.h.example config.h
```

2. Chỉnh sửa file `config.h` với thông tin của bạn:

```cpp
// MQTT Configuration
#define MQTT_SERVER "192.168.1.xxx"     // Địa chỉ IP máy chủ MQTT của bạn
#define MQTT_PORT 1883                  // Cổng MQTT (mặc định: 1883)
#define MQTT_USER ""                    // Tên người dùng MQTT (nếu có)
#define MQTT_PASSWORD ""                // Mật khẩu MQTT (nếu có)
#define MQTT_TOPIC "esp8266/sensor_data" // Chủ đề MQTT để gửi dữ liệu cảm biến

// WiFi Configuration
#define WIFI_SSID "your_wifi_ssid"      // Tên WiFi của bạn
#define WIFI_PASSWORD "your_wifi_password" // Mật khẩu WiFi của bạn

// Sensor Pin Configuration (chỉnh sửa nếu kết nối phần cứng khác)
#define DHTPIN D5                       // Chân kết nối cảm biến DHT11
#define DHTTYPE DHT11                   // Loại cảm biến DHT (DHT11 hoặc DHT22)
#define MQ2_PIN A0                      // Chân kết nối cảm biến khí gas MQ-2
#define BUZZER_PIN D7                   // Chân kết nối còi báo động
#define BUTTON_PIN D6                   // Chân kết nối nút tắt báo động
#define LED_ALARM_PIN D8                // Chân kết nối đèn LED báo động

// Threshold Values (có thể tùy chỉnh)
#define GAS_THRESHOLD 400               // Ngưỡng nồng độ khí gas để báo động
#define TEMP_THRESHOLD 45.0             // Ngưỡng nhiệt độ để báo động (độ C)
```

## Cách chạy hệ thống

### Chạy toàn bộ hệ thống

Sử dụng lệnh sau để khởi động toàn bộ hệ thống (bao gồm Mainflux và dịch vụ NodeJS):

```bash
./run.sh
```

hoặc

```bash
docker-compose -f mainflux/docker/docker-compose.yml -f mainflux/docker/nodejs-sensor-service.yml up --build -d
```

### Chạy riêng Mainflux platform

```bash
docker-compose -f mainflux/docker/docker-compose.yml up -d
```

### Chạy riêng dịch vụ NodeJS

```bash
cd nodejs-app
docker-compose up --build -d
```

### Nạp code cho NodeMCU

1. Mở thư mục `nodemcu/publisher` trong Arduino IDE hoặc PlatformIO
2. Kiểm tra lại file `config.h` đã được cấu hình đúng
3. Kết nối NodeMCU với máy tính qua cáp USB
4. Chọn board ESP8266 và cổng COM phù hợp
5. Nạp code lên NodeMCU

## Cấu trúc dự án

- `nodejs-app/` - Ứng dụng NodeJS xử lý dữ liệu cảm biến và gửi cảnh báo
  - `services/` - Các dịch vụ của ứng dụng
    - `telegram.js` - Dịch vụ gửi cảnh báo qua Telegram
    - `db.js` - Kết nối và truy vấn cơ sở dữ liệu
  - `index.js` - Điểm khởi đầu của ứng dụng
- `nodemcu/` - Code cho thiết bị NodeMCU
  - `publisher/` - Code gửi dữ liệu từ cảm biến lên MQTT
    - `publisher.ino` - File chính Arduino
    - `config.h` - Cấu hình kết nối và cảm biến
  
## Chức năng cảnh báo

Hệ thống cảnh báo qua Telegram trong các trường hợp:

1. **Rò rỉ khí gas**: Khi nồng độ gas vượt quá ngưỡng cấu hình (mặc định: 400)
2. **Nhiệt độ cao**: Khi nhiệt độ vượt quá ngưỡng cấu hình (mặc định: 45°C)
3. **Nguy cơ cháy nổ**: Khi đồng thời có cả rò rỉ khí gas và nhiệt độ cao

## Xử lý sự cố

### Không nhận được tin nhắn Telegram

1. Kiểm tra Bot Token và Chat ID trong file `.env`
2. Đảm bảo bot đã được thêm vào nhóm chat
3. Đảm bảo bạn đã nhắn tin cho bot (bắt đầu cuộc trò chuyện)

### NodeMCU không kết nối được với MQTT

1. Kiểm tra thông tin WiFi trong file `config.h`
2. Kiểm tra địa chỉ IP của MQTT broker
3. Đảm bảo MQTT broker đang chạy và có thể truy cập từ mạng WiFi

### Lỗi kết nối MQTT hoặc Database

1. Kiểm tra log container: `docker logs -f nodejs-sensor-service`
2. Kiểm tra kết nối mạng giữa các container

## Phát triển

Để phát triển và thử nghiệm cục bộ:

```bash
cd nodejs-app
npm install
npm run dev
```

## Giấy phép

[MIT](LICENSE)