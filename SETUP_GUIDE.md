# HƯỚNG DẪN CÀI ĐẶT MÔI TRƯỜNG, CÔNG CỤ & THƯ VIỆN (SETUP GUIDE)
## Dự án: SmartDroneDelivery — Hệ thống Quản lý Giao hàng bằng Drone (AI-Powered)

Tài liệu này cung cấp hướng dẫn chi tiết từ A-Z dành cho các thành viên trong nhóm phát triển để cài đặt công cụ (IDE/Tools), các thư viện cần thiết bằng dòng lệnh (CMD / PowerShell), và chạy được toàn bộ 3 phân hệ của hệ thống: **Backend (.NET 9)**, **Web Portal (React 19 + Tailwind v4)**, và **Mobile App (Flutter)**.

---

## 1. Tổng Quan Kiến Trúc & Cổng Dịch Vụ (Service Ports)

| Phân hệ | Công nghệ chính | Cổng (Port) mặc định | Lệnh chạy nhanh |
| :--- | :--- | :--- | :--- |
| **Backend API** | .NET 9.0 (C#), ASP.NET Core, EF Core 9, SignalR | `http://localhost:5028` | `dotnet run --project backend/src/SmartDroneDelivery.Api` |
| **Web Portal** | React 19, Vite 8, Tailwind CSS v4, Inter font | `http://localhost:5173` | `cd web; npm run dev` |
| **Mobile App** | Flutter 3.50, Dart 3.14 (Android / Windows / Web) | Tùy chọn thiết bị | `cd mobile; flutter run -d chrome` |
| **Database** | Microsoft SQL Server 2022 (hoặc Docker) | `localhost:1433` | Docker container hoặc SQL LocalDB |

> [!NOTE]
> **Khả năng chạy độc lập (In-Memory Fallback):** Hệ thống Backend đã được lập trình sẵn cơ chế tự động nạp dữ liệu mẫu (In-Memory Seed) cho Trạm, Drone, Tài khoản và Đơn hàng. Do đó, các thành viên **có thể chạy ngay Backend và Web/Mobile để test giao diện và API mà chưa bắt buộc phải cài đặt SQL Server**.

---

## 2. Danh Sách IDEs & Công Cụ Cần Thiết Cho Các Thành Viên

Các thành viên có thể lựa chọn cài đặt các IDE phù hợp với phân hệ mình phụ trách:

### 2.1. IDE Khuyên Dùng
1. **Visual Studio Code (Khuyên dùng cho tất cả thành viên)**:
   - Dùng để code Web (React), Mobile (Flutter), và Backend (.NET).
   - Link tải: [https://code.visualstudio.com/Download](https://code.visualstudio.com/Download)
2. **Visual Studio 2022 Community (Khuyên dùng cho thành viên làm Backend)**:
   - Phiên bản 17.12 trở lên (hỗ trợ .NET 9).
   - Chọn Workload: **ASP.NET and web development**.
   - Link tải: [https://visualstudio.microsoft.com/vs/community/](https://visualstudio.microsoft.com/vs/community/)
3. **Android Studio (Khuyên dùng cho thành viên làm Mobile Android)**:
   - Dùng để quản lý Android SDK, Android Virtual Device (AVD Emulator).
   - Link tải: [https://developer.android.com/studio](https://developer.android.com/studio)
4. **SQL Server Management Studio (SSMS) hoặc Azure Data Studio**:
   - Dùng để quản lý cơ sở dữ liệu SQL Server.
   - Link tải Azure Data Studio: [https://azure.microsoft.com/products/data-studio](https://azure.microsoft.com/products/data-studio)

---

### 2.2. Danh Sách Extension Cần Cài Cho VS Code

Mở CMD / PowerShell và chạy các lệnh sau để cài đặt nhanh toàn bộ Extension:

```powershell
# 1. Hỗ trợ C# & .NET 9
code --install-extension ms-dotnettools.csdevkit
code --install-extension ms-dotnettools.csharp
code --install-extension ms-dotnettools.vscode-dotnet-runtime

# 2. Hỗ trợ React, JavaScript & Tailwind CSS v4
code --install-extension bradlc.vscode-tailwindcss
code --install-extension dsznajder.es7-react-js-snippets
code --install-extension esbenp.prettier-vscode

# 3. Hỗ trợ Flutter & Dart
code --install-extension Dart-Code.dart-code
code --install-extension Dart-Code.flutter
```

---

## 3. Cài Đặt Nền Tảng Bằng CMD / PowerShell (Sử Dụng Winget)

Trên Windows 10/11, mở **PowerShell (Run as Administrator)** và chạy các lệnh dưới đây để tự động tải và cài đặt toàn bộ SDK nền tảng:

```powershell
# 1. Cài đặt Git
winget install --id Git.Git -e --source winget

# 2. Cài đặt .NET 9 SDK
winget install --id Microsoft.DotNet.SDK.9 -e --source winget

# 3. Cài đặt Node.js LTS (bao gồm npm)
winget install --id OpenJS.NodeJS.LTS -e --source winget

# 4. Khởi động lại CMD/PowerShell sau khi cài đặt để nhận biến môi trường PATH
```

### Kiểm tra phiên bản sau khi cài đặt:
```powershell
git --version      # Yêu cầu: >= 2.40
dotnet --version   # Yêu cầu: >= 9.0.100
node --version     # Yêu cầu: >= 18.x hoặc 20.x LTS
npm --version      # Yêu cầu: >= 9.x
```

---

## 4. Hướng Dẫn Cài Đặt & Chạy Từng Phân Hệ

Clone mã nguồn về máy (nếu chưa clone):
```powershell
git clone https://github.com/QCuong-SW/project_hequantricosodulieu.git
cd project_hequantricosodulieu
git checkout dev
```

---

### PHÂN HỆ 1: BACKEND (.NET 9 Web API)

#### Bước 1: Cài đặt công cụ EF Core CLI toàn cục
```powershell
dotnet tool install --global dotnet-ef
```
*(Nếu đã cài trước đó, có thể cập nhật: `dotnet tool update --global dotnet-ef`)*

#### Bước 2: Khôi phục NuGet Packages & Build dự án
Chạy lệnh tại thư mục gốc của repository:
```powershell
# Khôi phục các thư viện NuGet
dotnet restore backend/SmartDroneDelivery.sln

# Biên dịch toàn bộ Solution (.Api, .Application, .Domain, .Infrastructure)
dotnet build backend/SmartDroneDelivery.sln
```

**Các thư viện NuGet chính đã tích hợp trong Backend:**
- `Microsoft.AspNetCore.Authentication.JwtBearer (9.0.*)`: Xác thực JWT Bearer token
- `Microsoft.AspNetCore.OpenApi (9.0.12)`: Tài liệu API OpenAPI / Swagger
- `Microsoft.EntityFrameworkCore.SqlServer (9.0.*)`: ORM kết nối Microsoft SQL Server
- `EFCore.NamingConventions (9.0.0)`: Tự động chuyển đổi snake_case chuẩn Database
- `BCrypt.Net-Next (4.2.0)`: Băm mật khẩu người dùng chuẩn mật mã học
- `System.IdentityModel.Tokens.Jwt (8.23.0)`: Xử lý và cấp phát Access/Refresh Token

#### Bước 3: Khởi chạy Backend Server
```powershell
dotnet run --project backend/src/SmartDroneDelivery.Api/SmartDroneDelivery.Api.csproj --urls http://localhost:5028
```
- Khi chạy thành công, console sẽ hiển thị: `Now listening on: http://localhost:5028`
- Truy cập OpenAPI spec: `http://localhost:5028/openapi/v1.json`

---

### PHÂN HỆ 2: WEB PORTAL (React 19 + Vite + Tailwind CSS v4)

#### Bước 1: Di chuyển vào thư mục web và cài đặt thư viện npm
```powershell
cd web
npm install
```

**Các thư viện npm được cài đặt trong `web/package.json`:**
- `react (^19.3.1)` & `react-dom (^19.3.1)`: Thư viện giao diện React phiên bản 19 mới nhất
- `vite (^8.3.4)` & `@vitejs/plugin-react`: Công cụ bundler và server dev siêu tốc
- `tailwindcss (^4.3.5)` & `@tailwindcss/vite`: Framework Tailwind CSS v4 thế hệ mới không cần tailwind.config.js
- `oxlint (^1.88.0)`: Công cụ linter tốc độ cao

#### Bước 2: Khởi động Web Dev Server
```powershell
npm run dev
```
- Truy cập giao diện Web trên trình duyệt tại: **`http://localhost:5173`**

#### Bước 3: Kiểm tra Build sản phẩm (Production Build)
```powershell
npm run build
```
*(Đảm bảo kết quả hiển thị `built in ...ms` với 0 lỗi).*

---

### PHÂN HỆ 3: MOBILE APP (Flutter 3.50 & Dart 3.14)

#### Bước 1: Cài đặt Flutter SDK (Nếu máy chưa có)
1. Tải bản Flutter SDK 3.50.0 Windows: [https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.50.0-stable.zip](https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.50.0-stable.zip)
2. Giải nén vào thư mục: `C:\src\flutter`
3. Thêm đường dẫn `C:\src\flutter\bin` vào biến môi trường **PATH** của User hoặc System:
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\src\flutter\bin", [EnvironmentVariableTarget]::User)
   ```
4. Mở lại terminal mới và kiểm tra trạng thái:
   ```powershell
   flutter doctor
   ```

#### Bước 2: Cài đặt Packages cho Mobile App
```powershell
cd mobile
flutter pub get
```

**Các thư viện Flutter chính trong `mobile/pubspec.yaml`:**
- `http: ^1.6.0`: Gọi REST API và gửi/nhận JSON với Backend
- `shared_preferences: ^2.5.6`: Lưu trữ cục bộ JWT Access Token và Customer ID
- `cupertino_icons: ^1.0.8`: Icon phong cách iOS
- `material_ui: ^1.1.0`: Thiết kế giao diện Material Design
- `flutter_test`: Bộ khung chạy Unit Test & Widget Test tự động

#### Bước 3: Chạy ứng dụng Mobile
Các thành viên có thể chọn 1 trong 3 cách sau tùy vào máy cá nhân:

```powershell
# Cách A: Chạy trực tiếp trên trình duyệt Chrome (Khuyên dùng: Nhanh nhất, không tốn RAM máy ảo)
flutter run -d chrome

# Cách B: Chạy trên Windows Desktop (Cần cài Visual Studio Desktop development with C++)
flutter run -d windows

# Cách C: Chạy trên thiết bị Android thật (cắm cáp USB bật USB Debugging) hoặc Android Emulator
flutter devices
flutter run -d <device-id>
```

#### Bước 4: Chạy kiểm thử tự động (Unit Test)
```powershell
flutter test
```

---

### PHÂN HỆ 4: CƠ SỞ DỮ LIỆU SQL SERVER (Tùy chọn)

Nếu muốn kết nối cơ sở dữ liệu vật lý thay vì dùng cơ chế In-Memory Fallback:

#### Cách 1: Khởi động SQL Server 2022 bằng Docker (Tiện lợi nhất)
```powershell
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong@Password2026!" -p 1433:1433 --name mssql-drone -d mcr.microsoft.com/mssql/server:2022-latest
```

#### Cách 2: Sử dụng SQL Server đã cài trên máy
- Cập nhật chuỗi kết nối trong tập tin `backend/src/SmartDroneDelivery.Api/appsettings.json`:
  ```json
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=SmartDroneDeliveryDb;User Id=sa;Password=YourStrong@Password2026!;TrustServerCertificate=True;MultipleActiveResultSets=true;"
  }
  ```

---

## 5. Danh Sách Tài Khoản Thử Nghiệm Mặc Định (5 Vai Trò RBAC)

Tất cả tài khoản bên dưới đã được nạp sẵn mật khẩu chuẩn: **`P@ssword123!`**

| Vai trò (Role) | Email đăng nhập | Mật khẩu mặc định | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@smartdrone.vn` | `P@ssword123!` | Quản trị người dùng, phân quyền RBAC và xem Audit Logs |
| **DISPATCHER** | `dispatcher@smartdrone.vn` | `P@ssword123!` | Duyệt đơn hàng, tính AI ETA, phân bổ Drone và lên lịch bay |
| **STATION_OPERATOR** | `operator@smartdrone.vn` | `P@ssword123!` | Quét mã bàn giao tại trạm (`STATION_RECEIVED`, `LOADED_ON_DRONE`) |
| **LOGISTICS_MANAGER**| `manager@smartdrone.vn` | `P@ssword123!` | Theo dõi Dashboard tổng quan, phân tích cước phí & hiệu suất |
| **CUSTOMER** | `customer@smartdrone.vn` | `P@ssword123!` | Tạo đơn giao hàng bằng Drone, xem lịch sử và hủy đơn |

---

## 6. Cheatsheet — Bảng Tra Cứu Lệnh Nhanh Cho Thành Viên

| Thao tác | Câu lệnh CMD / PowerShell |
| :--- | :--- |
| Cập nhật code mới nhất từ git | `git checkout dev; git pull origin dev` |
| Build toàn bộ Backend C# | `dotnet build backend/SmartDroneDelivery.sln` |
| Chạy Backend API (Port 5028) | `dotnet run --project backend/src/SmartDroneDelivery.Api --urls http://localhost:5028` |
| Cài thư viện Web | `cd web; npm install` |
| Chạy Web Portal (Port 5173) | `cd web; npm run dev` |
| Kiểm tra build Web | `cd web; npm run build` |
| Cài thư viện Mobile | `cd mobile; flutter pub get` |
| Chạy Mobile trên Chrome | `cd mobile; flutter run -d chrome` |
| Chạy Test Mobile | `cd mobile; flutter test` |

---

## 7. Khắc Phục Lỗi Thường Gặp (Troubleshooting FAQ)

### Q1: Lỗi `ExecutionPolicy` khi chạy lệnh `npm` hoặc `flutter` trên PowerShell?
**Khắc phục:** Mở PowerShell với quyền Administrator và chạy:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Q2: Lỗi cổng 5028 hoặc 5173 bị chiếm dụng (Port already in use)?
**Khắc phục:** Tìm tiến trình đang chiếm cổng và tắt đi:
```powershell
# Tìm tiến trình chạy port 5028
Get-NetTCPConnection -LocalPort 5028 -ErrorAction SilentlyContinue | Select-Object OwningProcess

# Tắt tiến trình theo PID
Stop-Process -Id <PID_tìm_được> -Force
```

### Q3: Lỗi file `.dll` bị khóa (The file is locked by another process) khi `dotnet build`?
**Khắc phục:** Do tiến trình Backend `dotnet run` trước đó vẫn đang chạy ngầm. Hãy tắt tiến trình đó bằng:
```powershell
Stop-Process -Name "SmartDroneDelivery.Api" -Force -ErrorAction SilentlyContinue
dotnet build backend/SmartDroneDelivery.sln
```

### Q4: Flutter báo lỗi `Android license status unknown`?
**Khắc phục:** Chạy lệnh chấp nhận chứng chỉ:
```powershell
flutter doctor --android-licenses
# Bấm 'y' cho tất cả các câu hỏi
```
*(Nếu chỉ cần test giao diện nhanh, bạn chỉ cần dùng lệnh `flutter run -d chrome` mà không cần cài Android SDK).*
