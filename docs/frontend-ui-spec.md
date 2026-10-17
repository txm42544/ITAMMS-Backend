# Mô tả giao diện Frontend - Hệ thống quản lý vòng đời tài sản CNTT

> Tài liệu tham chiếu để build giao diện. Phạm vi 40 usecase × 5 actor (theo `requirements.txt`), kèm các màn hình tiện ích (QR scan, dashboard, báo cáo, cài đặt).
> Mọi dữ liệu đều dựa trên API backend đã có (xem `API_Documentation_Sample.txt` cho envelope `{ statusCode, message, data, meta, pagination }`).

---

## 0. Nguyên tắc chung cho toàn bộ UI

- **Ngôn ngữ**: Tiếng Việt, dùng chuỗi có dấu từ backend.
- **Định dạng**:
  - Tiền: `1.250.000 đ` (Intl.NumberFormat VN, đơn vị VND).
  - Ngày: `dd/MM/yyyy` (mặc định), `dd/MM/yyyy HH:mm` cho ngày giờ.
  - Mã: in hoa, monospace.
- **Màu trạng thái**: lấy từ `AssetStatus.color` (hex) — render badge có nền màu nhạt, chữ màu đậm.
- **Phân quyền hiển thị**: ẩn/hiện nút & menu dựa trên `permissions[]` trong `GET /auth/me`. Route guard ở client cũng dùng mảng này.
- **Phạm vi dữ liệu (data scope)**: tự áp dụng từ backend. UI chỉ cần thêm bộ lọc "Phòng ban" và "Tài sản của tôi" nếu user có cả 2 quyền.
- **Thông báo lỗi**: từ `exception.message` của backend, hiển thị toast 3-5s. Lỗi 401 → đẩy về màn hình đăng nhập.
- **Phân trang**: mọi danh sách dùng `?page=&limit=`, hiển thị "Tổng X / Y trang".
- **Tìm kiếm**: ô search gọi `?search=` (server tự tìm theo các field đã khai).
- **Sắp xếp**: header bảng có mũi tên ↑/↓, mặc định theo `sortBy`/`sortOrder` backend quy định.

---

## 1. Layout tổng thể (Áp dụng cho mọi trang sau đăng nhập)

```
┌─────────────────────────────────────────────────────────────────────┐
│  TopBar: Logo | Tên hệ thống | 🔍 Tìm nhanh (Cmd+K) | 🔔 | 👤 User │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│              │  Breadcrumb: Trang chủ / Module / Trang con         │
│              │                                                      │
│   Sidebar    │                                                      │
│   (icon +    │                Nội dung trang                        │
│   menu)      │                                                      │
│              │                                                      │
│              │                                                      │
│              │                                                      │
├──────────────┴──────────────────────────────────────────────────────┤
│  Footer: © 2026 - Phiên bản 1.0.0 | Môi trường | Trạng thái server │
└─────────────────────────────────────────────────────────────────────┘
```

### Sidebar — nhóm menu theo actor

Menu mặc định cho **Admin/QLTS**:
1. 📊 Tổng quan (Dashboard)
2. 📦 Tài sản
   - Danh sách tài sản
   - Lịch sử biến động
   - **Yêu cầu vòng đời** (cấp phát, thu hồi, điều chuyển, thanh lý)
3. 🛠️ Bảo trì
   - Kế hoạch bảo trì
   - Phiếu bảo trì
4. 🎫 Sự cố (Tickets)
   - Tất cả sự cố
   - Đề xuất sửa chữa/thay thế
5. 🧰 Kho linh kiện
   - Linh kiện
   - Lịch sử nhập/xuất
6. 📑 Báo cáo
   - Dashboard
   - Tài sản
   - Chi phí bảo trì
   - Hiệu suất IT
7. 🏢 Tổ chức
   - Phòng ban
   - Vị trí
   - Loại thiết bị
   - Loại sự cố
   - Trạng thái thiết bị
   - Nhà cung cấp
8. 👥 Tài khoản & Phân quyền (chỉ Admin)
   - Người dùng
   - Vai trò
   - Cấu hình hệ thống
9. 🔔 Thông báo
10. ⚙️ Cài đặt cá nhân

Menu cho **KTV** (ẩn 4, 7, 8):
1. Tổng quan
2. **Sự cố của tôi** (filter assignee=me)
3. **Phiếu bảo trì của tôi**
4. Tra cứu tài sản (có quét QR)
5. Kho (chỉ xem)
6. Thông báo
7. Hồ sơ

Menu cho **Nhân viên**:
1. Tổng quan (giới hạn)
2. Tài sản của tôi
3. Báo sự cố / Theo dõi sự cố của tôi
4. Thông báo
5. Hồ sơ

Menu cho **QLPB**:
1. Tổng quan phòng ban
2. Tài sản phòng ban
3. Yêu cầu chờ tôi duyệt
4. Sự cố phòng ban
5. Bảo trì phòng ban
6. Báo cáo phòng ban

---

## 2. Màn hình đăng nhập (`/login`)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                     [Logo hệ thống]                      │
│              Quản lý vòng đời tài sản CNTT              │
│                                                          │
│      ┌────────────────────────────────────────────┐      │
│      │  Tên đăng nhập                              │      │
│      │  [_________________________________]        │      │
│      │                                             │      │
│      │  Mật khẩu                          👁      │      │
│      │  [_________________________________]        │      │
│      │                                             │      │
│      │  [ ] Ghi nhớ tôi      Quên mật khẩu?        │      │
│      │                                             │      │
│      │  [        Đăng nhập           ]              │      │
│      │                                             │      │
│      │  © 2026 Công ty ABC                         │      │
│      └────────────────────────────────────────────┘      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Trường: `username`, `password`. Submit gọi `POST /auth/login`.
- Thất bại: toast đỏ `message` từ backend. Khoá 1 phút sau 5 lần sai (rate-limit throttler đã cấu hình 10/phút).
- Sau khi đăng nhập: lưu `accessToken` (memory), `refreshToken` (httpOnly cookie nếu backend trả qua cookie — nếu không thì localStorage với chú thích bảo mật).
- Lưu `user` (id, username, fullName, role, permissions) vào context toàn cục.

---

## 3. Tổng quan / Dashboard (`/`)

Route: `/` — gọi `GET /reports/dashboard`. Dùng cho cả Admin/QLTS/QLPB (Admin thấy tất cả, QLPB thấy phòng mình).

```
┌──────────────────────────────────────────────────────────────────┐
│ Tổng quan                                [Từ: __ / Đến: __] [⟳] │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │ Tổng TS  │ │ Giá trị  │ │ Sự cố mở│ │ Phiếu BT │              │
│ │   1,250  │ │  45 tỷ   │ │    37   │ │   142    │              │
│ │ ↑ 5%     │ │          │ │ 8 quá hạn│ │          │              │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│ ┌────────────────────────┐ ┌────────────────────────────────┐    │
│ │ Trạng thái thiết bị    │ │ Bảo hành                        │   │
│ │ ● Trong kho 320        │ │ Còn hạn:    980                │   │
│ │ ● Đang SD  810         │ │ Sắp hết:     60                │   │
│ │ ● Sửa chữa  35        │ │ Hết hạn:    210                │   │
│ │ ● Bảo trì  25         │ │ [Xem chi tiết →]               │   │
│ │ ● Hỏng       30       │ │                                  │   │
│ │ ● Mất         5       │ │                                  │   │
│ │ ● Thanh lý   25       │ │                                  │   │
│ └────────────────────────┘ └────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Cảnh báo nổi bật                                          │  │
│ │ • 5 tài sản sắp hết bảo hành trong 30 ngày tới            │  │
│ │ • 8 sự cố vượt SLA — xem ngay                             │  │
│ │ • 3 linh kiện dưới ngưỡng tối thiểu                       │  │
│ │ • 12 phiếu bảo trì quá hạn                                │  │
│ └──────────────────────────────────────────────────────────┘   │
│ ┌────────────────────────┐ ┌────────────────────────────────┐    │
│ │ Top 5 phòng ban        │ │ Top 5 KTV                      │    │
│ │ (số tài sản / giá trị)│ │ (số sự cố đã xử lý)           │    │
│ └────────────────────────┘ └────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

- 4 KPI cards ở trên: `assets.total`, `assets.totalValue`, `tickets.open/overdue`, `maintenance.dueWithin30Days`.
- Biểu đồ tròn "Trạng thái thiết bị": dùng `assets.byStatus[]` (mỗi phần tô màu `status.color`).
- Widget bảo hành: `warranty.{valid, expiringSoon, expired, none}`.
- Lọc nhanh theo khoảng ngày gọi `?fromDate=&toDate=`.
- Nhân viên (không có `report:view_*`): hiển thị "Bạn chưa có quyền xem báo cáo".

---

## 4. Quản lý tài sản (`/assets`)

### 4.1 Danh sách tài sản (`/assets`)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tài sản                                          [+ Thêm tài sản]    │
├────────────────────────────────────────────────────────────────────────┤
│ Bộ lọc: [Loại ▼] [Trạng thái ▼] [Phòng ban ▼] [Vị trí ▼] [NCC ▼]     │
│         [Người SD ▼] [Bảo hành: từ __ đến __] [🔍 Tìm tên/mã/serial]  │
│ Hiển thị: [☑ Tài sản của tôi] [📤 Xuất Excel] [📥 Import] [🖨 In QR]  │
├────────────────────────────────────────────────────────────────────────┤
│ ☐ │ Mã TS  │ Tên            │ Loại    │ Trạng thái │ PB    │ SD     │
│ ☐ │ LT-001 │ Laptop Dell…   │ Laptop  │ 🟢 Đang SD │ IT    │ Nguyễn │
│ ☐ │ MN-005 │ Màn hình LG…   │ Monitor │ 🟢 Đang SD │ HR    │ Trần   │
│ ☐ │ PC-002 │ PC HP Elite…   │ Desktop │ 🟡 Sửa    │ IT    │        │
│ …                                                                     │
│         ◀ 1 2 3 … 25 ▶      Tổng: 1,250  | 50/trang                  │
└────────────────────────────────────────────────────────────────────────┘
```

Hành động hàng loạt (chọn nhiều): In QR, Đổi trạng thái, Chuyển phòng ban.

Hành động từng dòng: Xem chi tiết, Sửa, Lịch sử, QR, Cấp phát, Thu hồi, Điều chuyển, Thanh lý.

### 4.2 Chi tiết tài sản (`/assets/:id`)

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Quay lại    LT-001 · Laptop Dell Latitude 5440        [⚙ Sửa]│
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐  Thông tin chung                                   │
│ │          │  • Mã tài sản: LT-2026-0001                        │
│ │  [Ảnh]   │  • Tên: Laptop Dell Latitude 5440                  │
│ │          │  • Loại: Laptop · Mã: LT                          │
│ │  [QR]    │  • Serial: DL-5440-XYZ                            │
│ │          │  • Trạng thái: 🟢 Đang sử dụng                     │
│ └──────────┘  • Phòng ban: IT · Vị trí: VP A-303                │
│                • Người sử dụng: Nguyễn Văn A                    │
├─────────────────────────────────────────────────────────────────┤
│ [Thông tin] [Cấu hình] [Bảo hành] [Tài chính] [Hình ảnh]        │
│ [Lịch sử] [Bảo trì] [Sửa chữa] [Vòng đời]                      │
├─────────────────────────────────────────────────────────────────┤
│ Tab "Lịch sử": bảng                                            │
│  Thời gian | Hành động | Mô tả | Bởi                           │
│  01/10/2026 | Cấp phát | Cấp cho Nguyễn Văn A | QLTS Trần      │
│  15/09/2026 | Sửa chữa | Thay RAM 8GB | KTV Lê                 │
│  …                                                              │
│                                                                 │
│ Tab "Bảo trì" → danh sách phiếu bảo trì (GET /assets/:id/      │
│ maintenance-history)                                            │
│ Tab "Sửa chữa" → danh sách sự cố (GET /assets/:id/repair-      │
│ history)                                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Form thêm/sửa tài sản (`/assets/new` hoặc `/assets/:id/edit`)

Form 2 cột:
- **Cột trái**: Mã tự sinh (readonly), Tên*, Loại thiết bị*, Hãng, Model, Serial, Nhà cung cấp, Ngày mua, Giá mua, Hoá đơn, Bảo hành (tháng).
- **Cột phải**: Phòng ban, Vị trí, Người sử dụng, Trạng thái, Chu kỳ bảo trì (tháng), Ngày bảo trì kế tiếp, Ghi chú.
- **Cấu hình**: render động từ `categoryId.specFields` (vd Laptop hiện 4 field cpu/ram/storage/os).
- **Hình ảnh**: upload nhiều ảnh qua `POST /upload/image`, hiển thị thumbnail, kéo-thả sắp xếp.

### 4.4 Import/Export

- **Xuất Excel**: gọi `GET /assets/export?…bộ lọc`, tải file `danh-sach-tai-san-2026-10-17.xlsx`.
- **Import**:
  ```
  ┌──────────────────────────────────────────────────────────────┐
  │ Import tài sản từ Excel                                       │
  │ Bước 1: Tải file mẫu  [⬇ Tải mẫu]                            │
  │ Bước 2: Chọn file  [Chọn file] [tai-san-import-2026-10.xlsx] │
  │ Bước 3: Xem trước                                              │
  │ ┌────────────────────────────────────────────────────────┐   │
  │ │ STT │ Tên           │ Mã loại │ Serial │ Kết quả      │   │
  │ │ 1   │ Laptop Dell…  │ LAPTOP  │ DL-001 │ ✅ Sẵn sàng  │   │
  │ │ 2   │ PC HP…        │ DESKTOP │ HP-002 │ ⚠ Mã DM trống│   │
  │ └────────────────────────────────────────────────────────┘   │
  │ [⏎ Bỏ qua dòng lỗi] [✓ Xác nhận import]                      │
  └──────────────────────────────────────────────────────────────┘
  ```

### 4.5 In QR hàng loạt (`/assets/qr/print`)

Chọn nhiều asset → gọi `POST /assets/qr/batch` → trang preview hiển thị tem QR theo dạng lưới (3 cột × 8 hàng/trang A4). Mỗi tem gồm: QR + mã TS + tên + phòng ban. Nút "In" mở hộp thoại in của trình duyệt.

### 4.6 Quét QR (`/scan/:token`)

Trang public (không cần đăng nhập cũng vào được), nhưng có đăng nhập thì hiển thị nhiều thông tin hơn.

```
┌────────────────────────────────────────────────────┐
│ Mã QR: DL-5440-XYZ                                │
│                                                    │
│  ┌─────────────┐  Laptop Dell Latitude 5440         │
│  │   [QR Code] │  • Mã: LT-2026-0001               │
│  │             │  • Phòng ban: IT                   │
│  │             │  • Trạng thái: 🟢 Đang sử dụng      │
│  │             │  • Người SD: Nguyễn Văn A          │
│  │             │  • Bảo hành: còn 280 ngày           │
│  │             │                                    │
│  │             │  [📋 Báo sự cố]   [📋 Xem chi tiết] │
│  └─────────────┘  (chỉ khi đã đăng nhập)            │
│                                                    │
│  Sự cố đang mở (3):                                │
│  • TC-2026-0012 · Hỏng bàn phím · IN_PROGRESS      │
│  • TC-2026-0010 · Sạc không vào · NEW              │
│  …                                                  │
└────────────────────────────────────────────────────┘
```

---

## 5. Yêu cầu vòng đời tài sản (`/asset-requests`)

### 5.1 Danh sách (`/asset-requests`)

```
│ Tabs: [Tất cả] [Chờ duyệt] [Đã duyệt] [Hoàn thành] [Huỷ] [⏰ Chờ tôi duyệt] │
│ Bộ lọc: [Loại yêu cầu ▼] [Phòng ban ▼] [Từ __ đến __]                       │
│ ┌────┬──────────┬──────────────┬──────────┬────────────┬──────────┬─────────┐ │
│ │ STT│ Mã       │ Loại         │ Trạng thái│ Phòng/Người│ Người tạo│ Xem     │ │
│ │ 1  │ AR-2026-1│ Cấp phát     │ ⏳ Chờ PB │ IT → Trần  │ QLTS     │ Chi tiết│ │
│ │ 2  │ AR-2026-2│ Điều chuyển  │ ✅ Đã duyệt│ HR → Sales │ QLTS     │ Chi tiết│ │
│ └────┴──────────┴──────────────┴──────────┴────────────┴──────────┴─────────┘ │
```

Loại yêu cầu: `Cấp phát (ALLOCATION)`, `Bàn giao (HANDOVER)`, `Thu hồi (RETURN)`, `Điều chuyển (TRANSFER)`, `Thanh lý (DISPOSAL)`.

### 5.2 Tạo yêu cầu (`/asset-requests/new`)

Form theo từng loại:
- **Cấp phát**: Asset (chọn từ danh sách "Trong kho"), Phòng ban nhận, Người nhận, Lý do, File đính kèm.
- **Điều chuyển**: Asset, Từ phòng ban, Đến phòng ban, Người đi/đến, Lý do.
- **Thanh lý**: Asset, Lý do, Phương án (bán/tháo/removal), Giá thu hồi dự kiến.

### 5.3 Chi tiết yêu cầu (`/asset-requests/:id`)

Hiển thị timeline duyệt nhiều cấp:
```
│ Mã: AR-2026-0012 · Loại: Cấp phát                   │
│ Trạng thái: ⏳ Chờ Trưởng phòng IT duyệt            │
│                                                       │
│ Bước 1 ✅: Tạo yêu cầu bởi QLTS Trần · 01/10 09:00  │
│ Bước 2 ⏳: Chờ Trưởng phòng IT duyệt                  │
│ Bước 3 ⏸ : QLTS thực hiện (chưa tới)                  │
│                                                       │
│ Asset: [LT-001 Laptop Dell]                            │
│ Từ: Kho · Đến: IT/Nguyễn Văn A                        │
│ Lý do: Nhân viên mới                                  │
│ File: hopdong.pdf                                      │
│                                                       │
│ Nút (theo quyền):                                      │
│  [✅ Duyệt] [❌ Từ chối] [⚙ Thực hiện] [⛔ Huỷ]      │
```

---

## 6. Bảo trì (`/maintenance`)

### 6.1 Kế hoạch bảo trì (`/maintenance-plans`)

```
│ Kế hoạch bảo trì                              [+ Tạo kế hoạch] │
│ ┌────────┬──────────────┬─────────────┬────────────┬──────────┐   │
│ │ Mã     │ Tên          │ Chu kỳ      │ Lần chạy KT│ Trạng thái│  │
│ │ MP-001 │ VS Laptop 6T │ Mỗi 6 tháng │ 15/10/2026 │ 🟢 Hoạt động│
│ │ MP-002 │ VS PC 12T    │ Mỗi 12 tháng│ -          │ ⏸ Tạm dừng│
│ └────────┴──────────────┴─────────────┴────────────┴──────────┘   │
│ Hành động: Xem phiếu đã sinh, Tạm dừng, Sửa, Xoá                  │
```

### 6.2 Tạo kế hoạch (`/maintenance-plans/new`)

```
│ Tên kế hoạch*    [Vệ sinh Laptop 6 tháng]                         │
│ Mô tả           [Vệ sinh bụi, thay keo tản nhiệt]                │
│ Phạm vi                                                                │
│   Loại thiết bị: [☑ Laptop] [☐ Desktop] [☐ Monitor]                 │
│   Phòng ban:    [☑ IT] [☐ HR] …                                     │
│   Tài sản cụ thể: (chọn bổ sung nếu muốn) [+]                       │
│ Chu kỳ         [6] tháng                                           │
│ Ngày bắt đầu*  [01/11/2026]                                        │
│ Ngày kết thúc  [31/12/2028] (tuỳ chọn)                             │
│ Cảnh báo trước [7] ngày                                            │
│ Checklist                                                            │
│   ☑ Vệ sinh quạt, khe tản nhiệt                                   │
│   ☑ Thay keo tản nhiệt                                             │
│   ☐ Cập nhật Windows                                                │
│ KTV mặc định   [Chọn KTV ▼]                                        │
│                                              [💾 Lưu]  [Hủy]      │
```

### 6.3 Phiếu bảo trì (`/maintenance-tasks`)

```
│ Phiếu bảo trì                                                       │
│ Tabs: [Tất cả] [Của tôi] [Chưa giao] [Quá hạn] [Hoàn thành]        │
│ Bộ lọc: [Kế hoạch ▼] [Asset ▼] [Khoảng ngày ▼]                      │
│ ┌──────────┬──────────────┬──────┬────────┬──────────┬──────────┐    │
│ │ Mã       │ Tài sản      │ KH   │ KTV    │ Hẹn      │ Trạng thái│   │
│ │ BT-2026-1│ LT-001 Dell  │ MP-1 │ Lê Văn│ 15/10    │ 🟡 IN_PROG│   │
│ │ BT-2026-2│ PC-002 HP    │ MP-1 │ -      │ 14/10    │ 🔴 OVERDUE│  │
│ └──────────┴──────────────┴──────┴────────┴──────────┴──────────┘    │
```

### 6.4 Thực hiện phiếu bảo trì (`/maintenance-tasks/:id`)

```
│ BT-2026-0001 · LT-001 · Trạng thái: 🟡 IN_PROGRESS                  │
│                                                                       │
│ ┌─ Checklist ───────────────┐  ┌─ Kết quả ────────────────────┐    │
│ │ ☑ Vệ sinh quạt    [Cmt]   │  │ Tình trạng sau: [Tốt ▼]      │    │
│ │ ☑ Thay keo tản nhiệt      │  │ Nhân công:    [200.000] đ     │    │
│ │ ☐ Cập nhật Windows [Lý do]│  │ Ghi chú:                      │    │
│ │                            │  │ [___________________________]  │    │
│ │ [+ Thêm mục]              │  │ Ảnh: [Kéo thả hoặc chọn ảnh]   │    │
│ └────────────────────────────┘  └──────────────────────────────────┘   │
│                                                                       │
│ Vật tư sử dụng                                                        │
│ ┌─────┬──────────────┬────┬───────┬───────┐                         │
│ │ Mã  │ Tên          │ SL │ Đơn giá│ T.Tiền│                         │
│ │ RAM8│ RAM 8GB      │ 1  │ 800k   │ 800k  │                         │
│ └─────┴──────────────┴────┴───────┴───────┘                         │
│ + Thêm linh kiện (mở modal chọn từ kho)                            │
│                                                                       │
│ Tổng chi phí: 1.000.000 đ (Vật tư 800k + Nhân công 200k)            │
│                                                                       │
│ [▶ Bắt đầu] [⏭ Bỏ qua] [✅ Hoàn thành]  [⛔ Hủy]                  │
```

---

## 7. Sự cố / Helpdesk (`/tickets`)

### 7.1 Danh sách sự cố

```
│ Sự cố                                   [+ Báo sự cố mới]            │
│ Tabs: [Tất cả] [Mới] [Của tôi] [Quá hạn] [Đã đóng] [Chờ tôi]        │
│ Bộ lọc: [Mức độ ▼] [Loại sự cố ▼] [KTV ▼] [Khoảng ngày]             │
│ ┌────┬──────────┬───────────────┬──────┬──────┬──────┬────────┐     │
│ │ #  │ Mã       │ Tài sản       │ Mức  │ KTV  │ Hẹn  │ Trạng  │     │
│ │ 1  │ TC-0012  │ LT-001 Dell   │ HIGH │ Lê Văn│Hôm nay│🟡 IN_P│    │
│ │ 2  │ TC-0010  │ MN-005 LG     │ LOW  │ -    │ Quá hạn│🔴 OVD │   │
│ └────┴──────────┴───────────────┴──────┴──────┴──────┴────────┘     │
```

### 7.2 Báo cáo sự cố (Nhân viên) (`/tickets/new`)

```
│ Báo cáo sự cố                                                        │
│                                                                       │
│ Tài sản*:  [🔍 Tìm tài sản... (quét QR hoặc chọn)]                  │
│  ┌─────────────────────────────────────────────────────┐              │
│  │ [Ảnh QR] LT-001 · Laptop Dell · IT · Nguyễn Văn A │              │
│  └─────────────────────────────────────────────────────┘              │
│                                                                       │
│ Loại sự cố*: [▼ Hỏng phần cứng] (mặc định HIGH, SLA 24h)           │
│ Mô tả*:       [Laptop không lên nguồn, đã thử pin và sạc]            │
│ Ảnh đính kèm: [Kéo thả vào đây hoặc chọn ảnh]                       │
│                                                                       │
│                          [💾 Gửi báo cáo]                            │
```

### 7.3 Chi tiết sự cố (`/tickets/:id`)

```
│ TC-2026-0012 · Hỏng laptop Dell                                      │
│ Trạng thái: 🟡 IN_PROGRESS · Mức: HIGH · Hạn: 14/10 17:00            │
│ Tài sản: [LT-001 →] · Người báo: Nguyễn Văn A · KTV: Lê Văn B       │
│                                                                       │
│ [Mô tả] [Tiến độ] [Linh kiện] [Chi phí] [Đề xuất] [Đánh giá]       │
│                                                                       │
│ Tab "Mô tả"                                                          │
│  Tiêu đề: Laptop không lên nguồn                                    │
│  Mô tả: Đã thử pin và sạc, không có tín hiệu.                       │
│  Ảnh: [img1] [img2] [img3]                                           │
│                                                                       │
│ Tab "Tiến độ" (timeline)                                              │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │ 14/10 09:00 ✅ NEW      Nguyễn Văn A tạo               │         │
│  │ 14/10 09:30 ✅ RECEIVED KTV Lê Văn B tiếp nhận         │         │
│  │ 14/10 10:00 ✅ ASSIGNED Giao Lê Văn B                   │         │
│  │ 14/10 10:15 ✅ IN_PROGRESS Bắt đầu xử lý                │         │
│  │              "Tháo máy kiểm tra main"                  │         │
│  └─────────────────────────────────────────────────────────┘         │
│  [+ Thêm ghi chú]                                                     │
│                                                                       │
│ Tab "Linh kiện"                                                       │
│  ┌────┬─────────┬────┬───────┬──────────┐                            │
│  │ Mã │ Tên     │ SL │ Đơn giá│ TT       │                            │
│  │ RAM│ RAM 8GB │ 1  │ 800k  │ 800k     │                            │
│  └────┴─────────┴────┴───────┴──────────┘                            │
│  [+ Thêm linh kiện]                                                   │
│                                                                       │
│ Tab "Chi phí": Nhân công 200k | Linh kiện 800k | Thuê ngoài 0 | Tổng 1.000.000│
│ Tab "Đề xuất": danh sách RepairRequest liên quan (nếu có)            │
│ Tab "Đánh giá": ⭐⭐⭐⭐⭐ "Sửa nhanh, nhiệt tình" (15/10 14:00)        │
│                                                                       │
│ Nút hành động (theo quyền & trạng thái):                              │
│  KTV: [📥 Tiếp nhận] [👤 Phân công] [▶ Bắt đầu] [🔍 Chuẩn đoán]    │
│       [🛠 Tạo đề xuất] [📦 Ghi linh kiện] [✅ Resolve]                │
│  Người báo: [❌ Huỷ] [⭐ Nghiệm thu] [🔁 Mở lại]                    │
```

### 7.4 Đề xuất sửa chữa / thay thế (`/repair-requests`)

Danh sách các đề xuất chờ duyệt:
```
│ Mã        │ Ticket     │ Tài sản    │ Loại           │ Chi phí  │ Trạng thái│
│ RR-2026-1 │ TC-2026-12 │ LT-001     │ Thay thế thiết bị│ 18.5tr │ ⏳ PENDING│
│ RR-2026-2 │ TC-2026-09 │ PC-002     │ Sửa ngoài       │ 1.2tr  │ ✅ APPROVE│
```

Chi tiết: hiện nội dung đề xuất + lý do + timeline + nút Duyệt/Từ chối (ghi lý do).

---

## 8. Kho linh kiện (`/spare-parts`)

### 8.1 Danh sách linh kiện (`/spare-parts`)

```
│ Linh kiện                                  [+ Thêm linh kiện]        │
│ Bộ lọc: [Loại tương thích ▼] [Tồn thấp ☐] [🔍 Tìm tên/mã]          │
│ ┌──────┬──────────────┬──────┬──────┬──────┬─────────┬───────┐       │
│ │ Mã   │ Tên          │ Đơn vị│ Tồn  │ Min  │ Đơn giá │ Trạng │      │
│ │ RAM-8│ RAM 8GB      │ thanh │ 12   │ 5    │ 800k    │ 🟢 BT │      │
│ │ SSD-256│ SSD 256GB  │ cái   │  3   │ 4    │ 900k    │ 🔴 Thấp│     │
│ └──────┴──────────────┴──────┴──────┴──────┴─────────┴───────┘       │
│ Hành động: Nhập kho, Điều chỉnh, Lịch sử, Sửa, Xoá                   │
```

### 8.2 Lịch sử nhập/xuất (`/stock-transactions`)

```
│ Lịch sử giao dịch kho                                                 │
│ Bộ lọc: [Loại GD ▼] [Khoảng ngày] [Linh kiện ▼]                      │
│ ┌──────┬────────────┬──────┬──────┬──────────┬──────┬────────┐         │
│ │ Mã GD│ Thời gian  │ Loại │ Mã LK│ SL       │ Tồn  │ Người  │         │
│ │ ST-1 │ 14/10 10:30│ XUẤT │ RAM-8│ 1 (Ticket│ 12   │ Lê Văn │         │
│ │ ST-2 │ 13/10 09:00│ NHẬP │ RAM-8│ 10       │ 13   │ QLTS   │         │
│ └──────┴────────────┴──────┴──────┴──────────┴──────┴────────┘         │
```

### 8.3 Nhập / Điều chỉnh kho (modal)

- **Nhập kho**: Linh kiện (readonly), Số lượng*, Đơn giá nhập, Nhà cung cấp, Số hoá đơn, Ghi chú.
- **Điều chỉnh**: Số lượng thực tế*, Lý do (kiểm kê, hỏng…). Hệ thống tự tính chênh lệch và ghi GD "ADJUST".

---

## 9. Báo cáo (`/reports`)

### 9.1 Báo cáo tài sản (`/reports/assets`)

```
│ Báo cáo tài sản  [Từ: __ / Đến: __] [Phòng ban: __] [📤 Xuất Excel]  │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│ │ Tổng tài sản    │  │ Tổng giá trị    │  │ Bảo hành còn hạn│        │
│ │    1,250        │  │  45.2 tỷ        │  │    980          │        │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                       │
│ [Biểu đồ: Phân bổ theo trạng thái]  [Biểu đồ: Theo loại thiết bị]   │
│                                                                       │
│ [Biểu đồ: Theo phòng ban]            [Biểu đồ: Theo tuổi thiết bị]   │
│                                                                       │
│ [Biểu đồ: Tình trạng bảo hành]      (bảng tóm tắt dưới mỗi biểu đồ)│
```

Có 4 loại biểu đồ chính:
- Cột/Pie: phân bổ trạng thái
- Cột chồng: theo phòng ban
- Đường: theo năm mua (xu hướng đầu tư)
- Heatmap: tồn kho theo loại × phòng ban

### 9.2 Báo cáo chi phí bảo trì (`/reports/maintenance-cost`)

```
│ Chi phí bảo trì/sửa chữa  [Từ: __ / Đến: __] [📤 Xuất Excel]        │
│ Tóm tắt:                                                            │
│  Vật tư: 12.5 tr · Nhân công: 8.2 tr · Thuê ngoài: 3.1 tr · Tổng: 23.8 tr│
│  Số phiếu: 142                                                     │
│                                                                       │
│ [Biểu đồ đường: Chi phí theo tháng — Tách 3 line Vật tư/Nhân/Thuê] │
│ [Biểu đồ cột: Top 10 tài sản tốn kém nhất]                         │
│ [Biểu đồ tròn: Chi phí theo loại thiết bị]                          │
│ [Biểu đồ cột ngang: Chi phí theo phòng ban]                          │
```

### 9.3 Hiệu suất IT (`/reports/it-performance`)

```
│ Hiệu suất IT [Từ: __ / Đến: __] [Phòng ban: __] [📤 Xuất Excel]    │
│ Tóm tắt:                                                            │
│  Tổng ticket: 245 · Đã xử lý: 220 · Đã đóng: 215 · Tỉ lệ đúng SLA: 87%│
│  Đánh giá TB: ⭐ 4.2 / 5                                            │
│                                                                       │
│ [Biểu đồ: Trạng thái ticket (Pie)]                                   │
│ [Bảng: Hiệu suất từng KTV — # ticket, # resolved, TB phản hồi, ⭐]  │
│ [Biểu đồ đường: TG phản hồi trung bình theo ngày]                   │
│ [Đồng hồ: Tỉ lệ đúng SLA]   [Đồng hồ: Đánh giá TB]                  │
```

### 9.4 Báo cáo theo phòng ban (QLPB)

Giống báo cáo tài sản nhưng dữ liệu tự lọc theo `user.departmentId`. Có thêm tiêu chí so sánh giữa các phòng.

---

## 10. Tổ chức (Admin)

### 10.1 Phòng ban (`/departments`)

```
│ Phòng ban                                  [+ Thêm phòng ban]      │
│ Cấu trúc cây:                                                      │
│  ▼ Công ty                                                         │
│    ├─ IT (Trưởng phòng: Nguyễn Văn A, 25 nhân viên)                │
│    │  ├─ IT - Hạ tầng                                              │
│    │  └─ IT - Phát triển                                           │
│    ├─ HR (Trưởng phòng: Trần Thị B)                                │
│    └─ Sales                                                        │
│                                                                   │
│ Mỗi phòng: xem, sửa, xoá, chọn trưởng phòng                       │
```

### 10.2 Loại thiết bị (`/asset-categories`)

```
│ ┌──────┬────────┬──────┬────────────────┬──────┬─────────┐           │
│ │ Mã   │ Tên    │ Prefix│ Spec fields   │ Chu kỳ│ Hữu ích│          │
│ │ LAP  │ Laptop │ LT   │ cpu,ram,storage│ 6 tháng│ 5 năm  │          │
│ └──────┴────────┴──────┴────────────────┴──────┴─────────┘           │
│ Cấu hình spec fields: nhập key/label/required, hiển thị khi tạo tài sản│
```

### 10.3 Loại sự cố (`/incident-types`)

```
│ ┌──────┬──────────────┬──────┬──────┐                                  │
│ │ Mã   │ Tên          │ Ưu tiên│ SLA │                                   │
│ │ HW   │ Hỏng phần cứng│ HIGH │ 24h │                                   │
│ │ NET  │ Sự cố mạng   │ HIGH │ 8h  │                                   │
│ └──────┴──────────────┴──────┴──────┘                                  │
```

### 10.4 Trạng thái thiết bị (`/asset-statuses`)

```
│ Thứ tự │ Mã       │ Tên           │ Màu  │ Hệ thống │ Cấp phát │ Cuối │
│ 10     │ IN_STOCK │ Trong kho     │ #64748b│ ☑        │ ☑        │ ☐   │
│ 20     │ IN_USE   │ Đang sử dụng  │ #16a34a│ ☑        │ ☐        │ ☐   │
│ 90     │ DISPOSED │ Đã thanh lý   │ #475569│ ☑        │ ☐        │ ☑   │
```

### 10.5 Vị trí, Nhà cung cấp

CRUD tương tự phòng ban (mã, tên, các trường thông tin bổ sung).

### 10.6 Cấu hình hệ thống (`/settings`) (chỉ Admin)

```
│ ┌─────────────────────┬──────┬──────────────────────────────────┐   │
│ │ Khoá                │ Giá trị │ Mô tả                          │   │
│ │ warrantyAlertDays   │ 30     │ Cảnh báo trước khi hết bảo hành│  │
│ │ maintenanceAlertDays│ 7      │ Cảnh báo trước khi đến hạn BT  │  │
│ │ ticketSlaDefaultHours│ 24   │ SLA mặc định nếu loại sự cố     │  │
│ │                     │       │ không khai báo                   │  │
│ └─────────────────────┴──────┴──────────────────────────────────┘   │
│ [Sửa hàng loạt]                                                      │
```

---

## 11. Tài khoản & Phân quyền (chỉ Admin)

### 11.1 Người dùng (`/users`)

```
│ Người dùng                                    [+ Thêm người dùng]    │
│ Bộ lọc: [Phòng ban ▼] [Vai trò ▼] [Trạng thái ▼] [🔍 Tìm tên/mã/email]│
│ ┌──────────┬─────────────────┬───────┬──────────┬────────┬────────┐   │
│ │ Mã NV    │ Họ tên          │ Email │ Phòng ban│ Vai trò│ Trạng  │  │
│ │ NV-001   │ Nguyễn Văn A    │ a@... │ IT       │ Admin  │ 🟢 Mở │  │
│ │ NV-002   │ Trần Thị B      │ b@... │ HR       │ QLTS   │ 🔴 Khoá│  │
│ └──────────┴─────────────────┴───────┴──────────┴────────┴────────┘   │
│ Hành động: Sửa, Khoá/Mở, Đặt lại MK, Xoá                            │
```

### 11.2 Vai trò (`/roles`)

```
│ Vai trò                                  [+ Thêm vai trò]           │
│ ┌──────┬─────────────────┬─────────┬──────────┐                       │
│ │ Mã   │ Tên             │ Số user │ Hệ thống │                       │
│ │ ADMIN│ Quản trị viên   │ 1       │ ☑        │                       │
│ │ QLTS │ Quản lý tài sản │ 3       │ ☑        │                       │
│ └──────┴─────────────────┴─────────┴──────────┘                       │
│ Hành động: Sửa, Phân quyền                                            │
```

### 11.3 Phân quyền (mở từ Sửa vai trò) (`/roles/:id/edit`)

```
│ Tên vai trò: [Quản lý tài sản]                                       │
│ Mô tả:       [Quản lý vòng đời tài sản, kho, kế hoạch bảo trì]       │
│                                                                       │
│ ☑ Tài sản                                                             │
│   ☑ Xem tất cả      ☑ Xem phòng ban      ☐ Xem của tôi               │
│   ☑ Thêm            ☑ Sửa                ☑ Xoá                        │
│   ☑ Import/Export   ☑ QR Code                                           │
│ ☑ Yêu cầu vòng đời                                                    │
│   ☑ Tạo             ☑ Duyệt PB           ☑ Duyệt thanh lý             │
│   ☑ Thực hiện                                                          │
│ ☑ Bảo trì                                                              │
│   ☑ Lập kế hoạch     ☑ Thực hiện           ☑ Xem tất cả               │
│ ☑ Sự cố (xem & xử lý)                                                  │
│ ☑ Kho linh kiện                                                          │
│   ☑ Quản lý          ☘� Xuất kho (chỉ KTV được)                          │
│ ☑ Báo cáo                                                                 │
│   ☑ Xem tất cả       ☐ Xem phòng ban                                       │
│ …                                                                      │
│                                              [💾 Lưu]                  │
```

---

## 12. Hồ sơ cá nhân (`/profile`)

```
│ Ảnh đại diện    [Chọn ảnh]   (lưu Cloudinary)                        │
│ Mã NV: NV-001                                                         │
│ Họ tên*: [Nguyễn Văn A]                                                │
│ Email:   [a@company.vn]                                                 │
│ Điện thoại: [0901…]                                                    │
│ Phòng ban: IT (readonly)                                                │
│ Vai trò:  Quản trị viên (readonly)                                      │
│                                                                       │
│ Đổi mật khẩu (mở rộng)                                                │
│   Mật khẩu hiện tại: [______]                                          │
│   Mật khẩu mới*:     [______]  (yêu cầu chữ hoa + số + ký tự đặc biệt)│
│   Xác nhận:         [______]                                          │
│                                              [💾 Lưu thay đổi]        │
```

---

## 13. Thông báo (`/notifications`)

```
│ Thông báo                                        [☑ Đánh dấu đã đọc hết]│
│ Bộ lọc: [☑ Chưa đọc] [Tất cả loại ▼]                                   │
│ ┌─────────────────────────────────────────────────────────────┐         │
│ │ 🔴 Bạn được phân công phiếu bảo trì BT-2026-0001           │        │
│ │    Tài sản LT-001 - 14/10 09:30 - [Đánh dấu đã đọc]        │        │
│ │                                                              │        │
│ │ 🟡 Sự cố TC-2026-0012 đã quá hạn SLA                        │        │
│ │    Hạn xử lý: 14/10 17:00 - [Đánh dấu đã đọc]                │        │
│ │                                                              │        │
│ │ 🟢 Tài sản LT-002 sắp hết bảo hành trong 15 ngày              │        │
│ │    12/10 07:00 - [Đánh dấu đã đọc]                           │        │
│ └─────────────────────────────────────────────────────────────┘         │
```

Icon chuông ở TopBar hiển thị badge số lượng chưa đọc (từ `GET /notifications/unread-count`). Click mở dropdown mini; click "Xem tất cả" → trang này.

---

## 14. Trang quét QR trên Mobile (`/scan/:token`)

Responsive, tối ưu cho màn hình điện thoại. Layout tương tự section 4.6. Đặc biệt:
- 2 nút chính lớn: "📋 Báo sự cố" (cam) và "🔍 Xem chi tiết" (xanh) — tối thiểu 48px.
- Cuộn dọc dễ dàng, font tối thiểu 16px để không zoom.
- Khi chưa đăng nhập: hiện banner "Đăng nhập để báo sự cố" với nút mở modal đăng nhập (không chuyển trang).

---

## 15. Trang lỗi chung

- **404** (`/not-found`): "Trang không tồn tại" + nút về Dashboard.
- **403** (`/forbidden`): "Bạn không có quyền truy cập" + liên hệ Admin.
- **500**: "Lỗi hệ thống" + mã lỗi + nút "Thử lại".

---

## 16. UX chung cho mọi modal/form

- **Modal** thay vì trang riêng cho: Báo cáo sự cố, Nhập kho, Thêm linh kiện vào phiếu, Đổi mật khẩu, Xác nhận huỷ.
- **Xác nhận** trước khi huỷ/xoá: hiện modal "Bạn có chắc chắn? Hành động này không thể hoàn tác." với 2 nút [Huỷ] [Xác nhận].
- **Loading state**: Skeleton cho bảng dữ liệu, spinner cho nút submit.
- **Empty state**: Bảng trống → hình minh hoạ + nút "Tạo mới".
- **Toast**: góc phải dưới, tự ẩn sau 3-5s, màu xanh cho thành công, đỏ cho lỗi, vàng cho cảnh báo.

---

## 17. Phím tắt & trợ năng

- `Cmd/Ctrl + K`: mở ô tìm kiếm nhanh (tài sản, ticket, người dùng).
- `Esc`: đóng modal.
- Mọi nút/icon có `aria-label` và tooltip tiếng Việt.
- Hỗ trợ chế độ tối (dark mode) — lưu theo user preference.

---

## 18. Mapping Use case → Trang (tổng hợp)

| Actor | Usecase | URL / Trang |
|---|---|---|
| Admin | Đăng nhập | `/login` |
| Admin | Quản lý TK & phân quyền | `/users`, `/roles` |
| Admin | Quản lý danh mục | `/locations`, `/suppliers`, `/settings` |
| Admin | Quản lý phòng ban | `/departments` |
| Admin | Quản lý loại thiết bị | `/asset-categories` |
| Admin | Quản lý loại sự cố | `/incident-types` |
| Admin | Quản lý trạng thái TB | `/asset-statuses` |
| QLTS | Quản lý thông tin tài sản | `/assets` |
| QLTS | Quản lý vòng đời tài sản | `/asset-requests` |
| QLTS | Lập KH bảo trì | `/maintenance-plans` |
| QLTS | Duyệt yêu cầu sửa/thay | `/repair-requests` |
| QLTS | Quản lý kho linh kiện | `/spare-parts`, `/stock-transactions` |
| QLTS | Quản lý QR Code | `/assets` (in QR) |
| QLTS | Theo dõi lịch sử | `/assets/:id` (tab Lịch sử) |
| QLTS | Thống kê / báo cáo | `/reports/*` |
| KTV | Tra cứu thiết bị | `/assets` |
| KTV | Quét QR | `/scan/:token` |
| KTV | Tiếp nhận & phân loại sự cố | `/tickets` + modal tiếp nhận |
| KTV | Kiểm tra thiết bị | `/tickets/:id` (tab Chuẩn đoán) |
| KTV | Xử lý sự cố | `/tickets/:id` |
| KTV | Thực hiện bảo trì | `/maintenance-tasks/:id` |
| KTV | Cập nhật trạng thái | Timeline trên `/tickets/:id` |
| KTV | Cập nhật vật tư | Modal "Thêm linh kiện" trên ticket/task |
| KTV | Ghi kết quả sửa/BT | Form trên ticket/task |
| KTV | Xem LS sửa/BT của TS | `/assets/:id` (tab Bảo trì / Sửa chữa) |
| NV | Đăng nhập | `/login` |
| NV | Xem TSDD | `/assets/my` |
| NV | Quét QR | `/scan/:token` |
| NV | Báo sự cố | `/tickets/new` |
| NV | Theo dõi tiến độ | `/tickets/my`, `/tickets/:id` |
| NV | Nghiệm thu | Modal "Nghiệm thu" trên `/tickets/:id` |
| NV | Xem LS yêu cầu | `/tickets/my` |
| NV | Xem LS thông báo | `/notifications` |
| QLPB | Đăng nhập | `/login` |
| QLPB | Xem DS tài sản PB | `/assets?department=me` |
| QLPB | Xem chi tiết TS | `/assets/:id` |
| QLPB | Duyệt cấp phát | `/asset-requests?pendingMyApproval=true` |
| QLPB | Duyệt bàn giao/thu hồi | `/asset-requests` (lọc theo loại) |
| QLPB | Duyệt điều chuyển | `/asset-requests?type=TRANSFER` |
| QLPB | Theo dõi TT tài sản | `/assets` |
| QLPB | Theo dõi tình trạng BT | `/maintenance-tasks` |
| QLPB | Theo dõi sự cố PB | `/tickets` |
| QLPB | Xem báo cáo PB | `/reports/*` (tự lọc theo PB) |

---

## 19. Ghi chú cho Frontend dev

1. **Mọi danh sách phải phân trang** — backend chuẩn `{ page, limit, total, totalPages }` trong `pagination`.
2. **Sắp xếp** — mặc định theo `sortBy` mỗi API. Cho phép click header để đổi chiều, gửi `?sortBy=&sortOrder=`.
3. **Tìm kiếm** — gửi `?search=`, backend tự loại regex injection.
4. **Dropdown chọn nhanh** — gọi các endpoint `/options` (vd `/locations/options`, `/users/options`).
5. **Upload ảnh** — dùng `POST /upload/image` (multipart), trả về `url` (Cloudinary).
6. **Thời gian** — backend trả ISO 8601. Client chuyển sang múi giờ VN (UTC+7) để hiển thị.
7. **Phạm vi dữ liệu** — tin tưởng backend đã lọc đúng theo quyền. Nếu cần, vẫn cho phép user chọn thêm "Phòng ban" / "Của tôi" nếu có nhiều hơn 1 quyền.
8. **Cron chạy nền** — không cần gọi. Trang quản trị có `POST /alerts/run/:job` để Admin demo.
9. **Tính tương thích trình duyệt** — Chrome/Edge mới nhất, Safari iOS (cho QR scan), Firefox (không bắt buộc).
10. **i18n** — toàn bộ UI tiếng Việt. Chuẩn bị cấu trúc key-value để dễ bổ sung tiếng Anh sau.
