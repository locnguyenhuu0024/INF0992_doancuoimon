# Hướng dẫn thiết lập Telegram Bot cho hệ thống cảnh báo

Tài liệu này hướng dẫn các bước thiết lập Telegram Bot để nhận cảnh báo khi khí gas vượt quá ngưỡng và báo cáo định kỳ từ hệ thống.

## Bước 1: Tạo Telegram Bot

1. Mở ứng dụng Telegram và tìm kiếm "@BotFather"
2. Bắt đầu trò chuyện với BotFather và gõ lệnh `/newbot`
3. Làm theo các hướng dẫn để đặt tên cho bot của bạn
4. Khi hoàn tất, BotFather sẽ cung cấp cho bạn một **token** như sau:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
5. **Lưu token này lại** - bạn sẽ cần nó để cấu hình hệ thống

## Bước 2: Lấy Chat ID

**QUAN TRỌNG**: Trước khi lấy Chat ID, bạn **PHẢI** bắt đầu cuộc trò chuyện với bot của mình bằng cách:
1. Tìm bot của bạn theo username (ví dụ: @YourBotName)
2. Nhấn nút "Start" hoặc gửi tin nhắn "/start" cho bot

Sau đó chọn một trong hai cách sau để lấy Chat ID:

### Cách 1: Sử dụng Bot API (Khuyến nghị)

1. Gửi ít nhất một tin nhắn cho bot của bạn
2. Truy cập URL sau trong trình duyệt (thay thế `YOUR_BOT_TOKEN` bằng token thực tế của bạn):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. Tìm phần có định dạng `"chat":{"id":XXXXXXXXX}` trong kết quả - đây là Chat ID của bạn
4. Chat ID thường là một số nguyên (ví dụ: 123456789) hoặc có thể là số âm đối với các group chat

### Cách 2: Sử dụng "IDBot"

1. Tìm kiếm "@userinfobot" trong Telegram
2. Bắt đầu trò chuyện và gửi bất kỳ tin nhắn nào
3. Bot sẽ trả về ID của bạn

## Bước 3: Cập nhật file .env

Mở file `.env` trong thư mục nodejs-app và cập nhật các thông tin sau:

```
# Telegram Configuration
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_CHAT_ID=YOUR_CHAT_ID_HERE
GAS_THRESHOLD=600
TELEGRAM_REPORT_INTERVAL=300000
```

**Lưu ý quan trọng về Chat ID**:
- Chat ID phải là một số nguyên (ví dụ: 123456789), không phải là username hay tên chat
- Đảm bảo không có dấu ngoặc kép, dấu nháy đơn hoặc khoảng trắng xung quanh Chat ID
- Đảm bảo không có khoảng trắng hoặc ký tự đặc biệt nào khác trong Chat ID

## Bước 4: Khởi động lại ứng dụng

Sau khi cập nhật thông tin, hãy khởi động lại ứng dụng:

```bash
npm start
```

## Xử lý lỗi "chat not found"

Nếu bạn gặp lỗi "chat not found", có thể là do một trong những nguyên nhân sau:

1. **Chưa khởi tạo chat**: Bạn chưa bắt đầu cuộc trò chuyện với bot của mình. Tìm bot của bạn theo username và gửi một tin nhắn hoặc nhấn nút "Start".

2. **Chat ID không đúng định dạng**: Chat ID phải là một số nguyên, không phải là tên người dùng hay string. Ví dụ đúng: `123456789` hoặc `-987654321`.

3. **Sử dụng Chat ID cũ**: Nếu bạn đã chặn hoặc xóa bot và sau đó bắt đầu lại cuộc trò chuyện, Chat ID có thể đã thay đổi.

4. **Nhầm lẫn giữa Bot ID và Chat ID**: Bot ID là phần đầu của token (vd: 123456789), trong khi Chat ID là ID của cuộc trò chuyện giữa bạn và bot.

### Cách khắc phục:

1. Đảm bảo bạn đã gửi tin nhắn cho bot
2. Truy cập URL `https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates`
3. Kiểm tra phần JSON trả về và tìm `"chat":{"id":XXXXXXXXX}`
4. Cập nhật giá trị TELEGRAM_CHAT_ID trong file .env
5. Khởi động lại ứng dụng

## Kiểm tra 

Khi hệ thống khởi động thành công, bạn sẽ nhận được tin nhắn khởi động từ bot:

```
🤖 Gas monitoring system is now online.
```

Sau đó, bạn sẽ nhận được:
- Báo cáo định kỳ mỗi 5 phút
- Cảnh báo khẩn cấp khi khí gas vượt ngưỡng 600
- Thông báo khi mức khí gas trở lại bình thường

## Xử lý sự cố khác

Nếu bạn không nhận được tin nhắn từ bot hoặc gặp các lỗi khác:

1. Kiểm tra log lỗi trong console
2. Đảm bảo token và chat ID đã được cung cấp đúng
3. Xác nhận rằng bạn đã bắt đầu cuộc trò chuyện với bot của mình
4. Kiểm tra kết nối internet
5. Đảm bảo bot chưa bị block hoặc delete bởi người dùng

## Tùy chỉnh

Bạn có thể thay đổi các tham số trong file `.env` để điều chỉnh:
- `GAS_THRESHOLD`: Tăng hoặc giảm để thay đổi ngưỡng cảnh báo
- `TELEGRAM_REPORT_INTERVAL`: Thay đổi thời gian giữa các báo cáo (tính bằng mili giây) 