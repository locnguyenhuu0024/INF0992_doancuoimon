# Tích hợp NodeJS Sensor Subscriber với Mainflux

Tài liệu này cung cấp hướng dẫn về cách tích hợp dịch vụ theo dõi dữ liệu cảm biến NodeJS với hệ thống Docker Compose của Mainflux.

## Phương án đã triển khai: Sử dụng File run.sh

Các bước đã được thực hiện để thiết lập và tích hợp dịch vụ:

1. File `nodejs-sensor-service.yml` đã được tạo trong thư mục mainflux/docker
2. Các biến môi trường đã được thêm vào file mainflux/docker/.env
3. File run.sh đã được cấu hình để chạy cả hai file docker-compose

Để khởi động toàn bộ hệ thống:

```bash
./run.sh
```

## Cấu hình biến môi trường

Dịch vụ NodeJS sử dụng cả biến môi trường có sẵn của Mainflux (cho cơ sở dữ liệu) và biến môi trường mới (cho MQTT):

```
## Biến MQTT cho NodeJS Sensor Subscriber
MF_SENSOR_MQTT_BROKER_URL=mqtt://mosquitto
MF_SENSOR_MQTT_PORT=1884
MF_SENSOR_MQTT_CLIENT_ID=nodejs_subscriber_client
MF_SENSOR_MQTT_USERNAME=
MF_SENSOR_MQTT_PASSWORD=
MF_SENSOR_MQTT_TOPIC=esp8266/sensor_data
MF_SENSOR_MQTT_QOS=0
```

Bạn có thể điều chỉnh các giá trị này trong file .env để thay đổi cấu hình mà không cần sửa đổi file docker-compose.

## Sử dụng cơ sở dữ liệu chung

Dịch vụ NodeJS sử dụng cơ sở dữ liệu PostgreSQL của MQTT Adapter (mqtt-db) để tận dụng tài nguyên hiện có và tránh trùng lặp. Dữ liệu cảm biến sẽ được lưu trữ trong cùng database với các subscription MQTT.

## Phương án thay thế: Thêm trực tiếp vào file docker-compose.yml chính

Bạn vẫn có thể thêm dịch vụ này trực tiếp vào file docker-compose.yml chính bằng cách:

Thêm dịch vụ sau vào phần services hiện có:
```yaml
services:
  # ... các dịch vụ khác
  
  nodejs-sensor-subscriber:
    build: 
      context: ../../nodejs-app
      dockerfile: Dockerfile
    container_name: nodejs-sensor-subscriber
    restart: on-failure
    environment:
      NODE_ENV: production
      # Cấu hình PostgreSQL
      PGUSER: ${MF_MQTT_ADAPTER_DB_USER}
      PGHOST: mqtt-db
      PGDATABASE: ${MF_MQTT_ADAPTER_DB}
      PGPASSWORD: ${MF_MQTT_ADAPTER_DB_PASS}
      PGPORT: 5432
      # Cấu hình MQTT
      MQTT_BROKER_URL: ${MF_SENSOR_MQTT_BROKER_URL}
      MQTT_PORT: ${MF_SENSOR_MQTT_PORT}
      MQTT_CLIENT_ID: ${MF_SENSOR_MQTT_CLIENT_ID}
      MQTT_USERNAME: ${MF_SENSOR_MQTT_USERNAME}
      MQTT_PASSWORD: ${MF_SENSOR_MQTT_PASSWORD}
      MQTT_TOPIC: ${MF_SENSOR_MQTT_TOPIC}
      MQTT_QOS: ${MF_SENSOR_MQTT_QOS}
    networks:
      - mainfluxlabs-base-net
    depends_on:
      - mosquitto
      - mqtt-db
```

## Truy cập cơ sở dữ liệu PostgreSQL

Cơ sở dữ liệu PostgreSQL cho dữ liệu cảm biến có thể truy cập qua cổng 5441 của máy chủ (cổng đã được mapping cho mqtt-db):

- Host: localhost
- Port: 5441
- Database: subscriptions (giá trị mặc định của MF_MQTT_ADAPTER_DB)
- Username: mainflux (giá trị mặc định của MF_MQTT_ADAPTER_DB_USER)
- Password: mainflux (giá trị mặc định của MF_MQTT_ADAPTER_DB_PASS)

Bạn có thể kết nối bằng bất kỳ phần mềm PostgreSQL client nào như pgAdmin hoặc sử dụng dòng lệnh:

```bash
psql -h localhost -p 5441 -U mainflux -d subscriptions
```

## Luồng Dữ liệu

1. Thiết bị ESP8266 gửi dữ liệu cảm biến đến topic MQTT `esp8266/sensor_data`
2. MQTT broker Mosquitto nhận và định tuyến các tin nhắn
3. Dịch vụ nodejs-sensor-subscriber đăng ký với topic, xử lý dữ liệu và lưu trữ trong cơ sở dữ liệu PostgreSQL (mqtt-db)
4. Dữ liệu sẵn sàng để truy vấn và phân tích thông qua cơ sở dữ liệu PostgreSQL

## Xử lý Sự cố

Nếu bạn gặp vấn đề:

1. Kiểm tra log:
```bash
docker logs nodejs-sensor-subscriber
```

2. Đảm bảo MQTT broker Mosquitto đang chạy:
```bash
docker logs mosquitto
```

3. Kiểm tra kết nối cơ sở dữ liệu:
```bash
docker exec -it mainfluxlabs-mqtt-db psql -U mainflux -d subscriptions -c "SELECT 1"
``` 