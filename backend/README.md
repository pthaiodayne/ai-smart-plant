📋 Cách setup database

Bước 1: Cài đặt SQLite3 (nếu chưa có)
bash
🍎 MacOS
brew install sqlite3
# Kiểm tra đã cài chưa
sqlite3 --version

🪟 Windows
Cách 1: Dùng Chocolatey (khuyến nghị)
bash
# Mở Command Prompt với quyền Administrator
choco install sqlite3

# Kiểm tra
sqlite3 --version
Cách 2: Tải trực tiếp

Truy cập: https://www.sqlite.org/download.html
Tải file: sqlite-tools-win32-x86-*.zip
Giải nén vào thư mục, ví dụ: C:\sqlite
Thêm đường dẫn vào PATH:

Mở System Properties → Advanced → Environment Variables
Thêm C:\sqlite vào biến PATH
Cách 3: Dùng Git Bash (nếu đã cài Git)

bash
# Mở Git Bash
# SQLite thường có sẵn, kiểm tra:
sqlite3 --version

Bước 2: Cài đặt dependencies trong project
🍎 MacOS & 🪟 Windows

bash
cd /Users/duyquang/Documents/ai-smart-plant/backend

# Cài sqlite3 package cho Node.js
npm install sqlite3
Trên Windows (nếu dùng Command Prompt):

cmd
cd C:\Users\YourName\Documents\ai-smart-plant\backend
npm install sqlite3

Bước 3: Tạo file database.js (đã có)

File này tự động tạo database và các bảng khi server chạy.

Bước 4: Chạy server lần đầu để tạo database

Bước 4: Chạy server lần đầu để tạo database

🍎 MacOS

bash
cd /Users/duyquang/Documents/ai-smart-plant/backend
node src/server.js
🪟 Windows (Command Prompt)

cmd
cd C:\Users\YourName\Documents\ai-smart-plant\backend
node src/server.js
🪟 Windows (PowerShell)

powershell
cd C:\Users\YourName\Documents\ai-smart-plant\backend
node src/server.js
🪟 Windows (Git Bash)

bash
cd /c/Users/YourName/Documents/ai-smart-plant/backend
node src/server.js

Các API đang hoạt động

1. Health check
http://localhost:3000/health

2. Sensor APIs
http://localhost:3000/api/sensor/latest	Lấy dữ liệu sensor mới nhất
http://localhost:3000/api/sensor/history	Lấy lịch sử dữ liệu sensor
http://localhost:3000/api/sensor-data	Gửi dữ liệu sensor từ ESP32

3. Device APIs
http://localhost:3000/api/device/command	Lấy lệnh điều khiển mới nhất (ESP32 gọi)
http://localhost:3000/api/device/control	Gửi lệnh điều khiển từ dashboard

4. Plant APIs
http://localhost:3000/api/plants	Lấy danh sách tất cả cây
http://localhost:3000/api/plant-profile/:plant	Lấy thông số của 1 loại cây

5. Advice API
http://localhost:3000/api/advice	Lấy lời khuyên dựa trên sensor hiện tại