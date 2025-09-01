# 🚀 WinterX - Ứng Dụng Chat Realtime

## 📝 Giới Thiệu
WinterX là một ứng dụng chat realtime hiện đại được xây dựng với ASP.NET Core và React, cung cấp trải nghiệm nhắn tin mượt mà và nhiều tính năng phong phú. Ứng dụng tập trung vào hiệu suất cao, trải nghiệm người dùng tốt và khả năng mở rộng.

## ⭐ Tính Năng Nổi Bật

### 💬 Chat Realtime
- Gửi/nhận tin nhắn tức thì
- Hiển thị trạng thái tin nhắn (đang gửi, đã gửi, đã nhận)
- Hỗ trợ gửi file và hình ảnh
- Reply và forward tin nhắn
- Xóa tin nhắn
- Chat nhóm với nhiều người

### 👥 Quản Lý Người Dùng
- Đăng ký và đăng nhập
- Cập nhật thông tin cá nhân
- Upload avatar
- Thêm/xóa bạn bè
- Chặn/bỏ chặn người dùng
- Hiển thị trạng thái online/offline

### 👥 Tính Năng Nhóm
- Tạo nhóm chat mới
- Thêm/xóa thành viên
- Quản lý quyền thành viên
- Cài đặt nhóm (tên, avatar, mô tả)
- Nhóm công khai/riêng tư

## 🛠️ Công Nghệ Sử Dụng

### Frontend
- React 18
- TypeScript
- TailwindCSS
- SignalR Client
- React Query

### Backend
- ASP.NET Core
- Entity Framework Core
- SQL Server
- SignalR
- JWT Authentication

## 🔥 Tối Ưu Hiệu Năng

### Tải Tin Nhắn
- Hiển thị ngay 12 tin nhắn gần nhất
- Virtual scrolling cho tin nhắn
- Cache tin nhắn thông minh
- Tải tin nhắn cũ trong nền

### Xử Lý Duplicate
- Chống gửi trùng tin nhắn
- Xử lý đồng bộ khi reload
- Tối ưu cache và bộ nhớ
- Quản lý trạng thái tin nhắn

### Realtime
- Kết nối SignalR ổn định
- Tự động reconnect
- Đồng bộ trạng thái realtime
- Thông báo typing

## 🏗️ Kiến Trúc Hệ Thống

### Frontend
- Sử dụng hooks tùy chỉnh
- Quản lý state hiệu quả
- Tối ưu re-render
- Xử lý lỗi và loading state

### Backend
- Clean Architecture
- Repository Pattern
- Unit of Work
- Dependency Injection

## 🛡️ Bảo Mật
- JWT Authentication
- Refresh Token
- Mã hóa mật khẩu
- Validation input
- Rate limiting
- HTTPS

## 📊 Database
- SQL Server
- Entity Framework Core
- Code First Migrations
- Relationship mapping
- Index optimization

## 🚀 Hướng Dẫn Cài Đặt

### Backend
1. Clone repository
2. Cập nhật connection string trong `appsettings.json`
3. Chạy migrations:
```bash
dotnet ef database update
```
4. Khởi chạy server:
```bash
dotnet run
```

### Frontend
1. Di chuyển vào thư mục frontend:
```bash
cd fe
```
2. Cài đặt dependencies:
```bash
npm install
```
3. Khởi chạy development server:
```bash
npm start
```

## 🔧 Cấu Hình

### Backend (`appsettings.json`)
- Database connection
- JWT settings
- CORS policy
- File upload limits

### Frontend (`config.ts`)
- API endpoints
- SignalR hub URL
- Upload limits
- Feature flags


© 2025 WinterX. Developed  by GianT404
