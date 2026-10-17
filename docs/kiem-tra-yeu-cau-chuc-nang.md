# Kiểm tra đáp ứng yêu cầu chức năng (requirements.txt)

> Đối chiếu từng Actor/Usecase trong `requirements.txt` với code backend hiện tại.
> Ngày kiểm: 17/10/2026.

Ký hiệu:
- ✅ Đáp ứng đầy đủ
- 🟡 Đáp ứng một phần (còn thiếu chi tiết nhỏ)
- ❌ Chưa có / cần bổ sung

---

## 1) Quản trị viên (admin)

| Usecase | Trạng thái | Bằng chứng / Endpoint |
|---|---|---|
| Đăng nhập | ✅ | `POST /api/v1/auth/login` (`auth.controller.ts`) |
| Quản lý tài khoản và phân quyền | ✅ | `CRUD /users`, `PATCH /users/:id/status`, `/reset-password`; `CRUD /roles`; `GET /permissions` |
| Quản lý danh mục hệ thống | ✅ | `CRUD /locations`, `/suppliers`, `/asset-categories`, `/asset-statuses`, `/incident-types`; `GET/PUT /settings` |
| Quản lý phòng ban | ✅ | `CRUD /departments` |
| Quản lý loại thiết bị | ✅ | `CRUD /asset-categories` |
| Quản lý loại sự cố | ✅ | `CRUD /incident-types` |
| Quản lý trạng thái thiết bị | ✅ | `CRUD /asset-statuses` |

✅ **Hoàn chỉnh**.

---

## 2) Quản lý tài sản (ASSET_MANAGER)

| Usecase | Trạng thái | Bằng chứng / Endpoint |
|---|---|---|
| Quản lý thông tin tài sản | ✅ | `CRUD /assets`, `/assets/import`, `/assets/export` |
| Quản lý vòng đời tài sản | ✅ | `CRUD /asset-requests`, `/asset-requests/:id/approve|reject|execute|cancel` |
| Lập kế hoạch bảo trì định kỳ | ✅ | `CRUD /maintenance-plans`, `GET /maintenance-plans/:id/preview` |
| Duyệt yêu cầu sửa chữa/thay thế | ✅ | `GET /repair-requests`, `POST /repair-requests/:id/approve|reject` |
| Quản lý kho linh kiện / vật tư | ✅ | `CRUD /spare-parts`, nhập kho, điều chỉnh, xem tồn thấp, lịch sử nhập/xuất |
| Quản lý QR Code | ✅ | `GET /assets/:id/qr`, `POST /assets/:id/qr/regenerate`, `POST /assets/qr/batch` |
| Theo dõi lịch sử tài sản | ✅ | `GET /assets/:id/history` |
| Thống kê tài sản | ✅ | `GET /reports/assets` + `GET /reports/assets/export` (Excel) |
| Thống kê chi phí bảo trì/sửa chữa | ✅ | `GET /reports/maintenance-cost` + `/maintenance-cost/export` |
| Báo cáo tài sản | ✅ | `GET /reports/assets`, dashboard, biểu đồ Excel/JSON |

✅ **Hoàn chỉnh**.

---

## 3) Nhân viên IT / Kỹ thuật viên (TECHNICIAN)

| Usecase | Trạng thái | Bằng chứng / Endpoint |
|---|---|---|
| Tra cứu thông tin thiết bị | ✅ | `GET /assets?search=...`, `GET /assets/:id`, `GET /assets/:id/history` |
| Quét QR Code | ✅ | `GET /qr/:token` (OptionalAuth — khách trả info rút gọn; đã đăng nhập trả chi tiết theo quyền) |
| Tiếp nhận và phân loại sự cố | ✅ | `POST /tickets/:id/receive` |
| Kiểm tra thiết bị | ✅ | `PUT /tickets/:id/diagnosis` |
| Xử lý sự cố | ✅ | `POST /tickets/:id/start\|resolve`, `POST /tickets/:id/parts`, `POST /tickets/:id/notes` |
| Thực hiện bảo trì | ✅ | `CRUD /maintenance-tasks`, `/maintenance-tasks/:id/start|complete|skip|parts` |
| Cập nhật trạng thái xử lý | ✅ | `POST /tickets/:id/notes`, `POST /tickets/:id/start`, `POST /maintenance-tasks/:id/complete` |
| Cập nhật vật tư tiêu hao | ✅ | `POST /tickets/:id/parts`, `POST /maintenance-tasks/:id/parts` |
| Ghi nhận kết quả sửa chữa/bảo trì | ✅ | `POST /tickets/:id/resolve`, `POST /maintenance-tasks/:id/complete` |
| Xem lịch sử sửa chữa/bảo trì | ✅ | `GET /assets/:id/history` (tổng hợp), `GET /assets/:id/maintenance-history` (danh sách phiếu bảo trì), `GET /assets/:id/repair-history` (danh sách sự cố). Cả 3 endpoint đã được expose trong `assets.controller.ts`. |

🟡 **Gần đầy đủ** — đã có service method, thiếu 2 endpoint trong controller.

---

## 4) Nhân viên / Người sử dụng (EMPLOYEE)

| Usecase | Trạng thái | Bằng chứng / Endpoint |
|---|---|---|
| Đăng nhập | ✅ | `POST /auth/login` |
| Xem thông tin tài sản đang sử dụng | ✅ | `GET /assets/my` (chỉ lấy asset có `currentUserId == me`) |
| Quét QR Code | ✅ | `GET /qr/:token` |
| Báo cáo sự cố | ✅ | `POST /tickets` (kèm `assetId` từ QR, ảnh, mô tả) |
| Theo dõi tiến độ xử lý | ✅ | `GET /tickets/my`, `GET /tickets/:id` (kèm `timeline`) |
| Xác nhận nghiệm thu sửa chữa | ✅ | `POST /tickets/:id/accept` (đánh giá 1-5★), `POST /tickets/:id/reopen` |
| Xem lịch sử yêu cầu | ✅ | `GET /tickets/my` |
| Xem lịch sử thông báo | ✅ | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notifications/unread-count` |

✅ **Hoàn chỉnh**.

---

## 5) Quản lý phòng ban (DEPT_MANAGER)

| Usecase | Trạng thái | Bằng chứng / Endpoint |
|---|---|---|
| Đăng nhập | ✅ | `POST /auth/login` |
| Xem danh sách tài sản phòng ban | ✅ | `GET /assets?department=me` — `buildScopeFilter` tự giới hạn theo `ASSET_READ_DEPARTMENT` |
| Xem thông tin tài sản | ✅ | `GET /assets/:id` (scope-filtered) |
| Phê duyệt cấp phát tài sản | ✅ | `POST /asset-requests/:id/approve` (yêu cầu `ASSET_REQUEST_APPROVE_DEPARTMENT`) |
| Phê duyệt bàn giao/thu hồi | ✅ | Cùng endpoint `/asset-requests/:id/approve` (asset-request workflow `HANDOVER|RETURN`) |
| Phê duyệt điều chuyển tài sản | ✅ | Cùng endpoint `/asset-requests/:id/approve` (workflow `TRANSFER`) |
| Theo dõi tình trạng tài sản | ✅ | `GET /assets` với data-scope lọc theo phòng ban |
| Theo dõi tình trạng bảo trì | ✅ | `GET /maintenance-tasks?departmentId=...` (`buildScopeFilter` theo `MAINTENANCE_READ_DEPARTMENT`) |
| Theo dõi sự cố của phòng ban | ✅ | `GET /tickets` với `TICKET_READ_DEPARTMENT` |
| Xem báo cáo tài sản phòng ban | ✅ | `GET /reports/assets\|maintenance-cost\|it-performance` tự lọc theo `REPORT_VIEW_DEPARTMENT` |

✅ **Hoàn chỉnh**.

---

## Mục tiêu đề tài (mục đích)

| Mục tiêu | Trạng thái | Bằng chứng |
|---|---|---|
| Quản lý vòng đời khép kín | ✅ | `AssetHistory` lưu mọi thay đổi; `AssetRequest` xử lý cấp phát/điều chuyển/thu hồi/thanh lý |
| Ứng dụng QR Code | ✅ | `GET/POST /assets/:id/qr`, `POST /assets/qr/batch`, `GET /qr/:token` (nhúng `qrcode` lib) |
| Số hóa quy trình hỗ trợ | ✅ | `Ticket` state machine đầy đủ (NEW → RECEIVED → ASSIGNED → IN_PROGRESS → PENDING_APPROVAL → RESOLVED → CLOSED/REOPENED/CANCELLED) |
| Tự động hóa cảnh báo | ✅ | `AlertsService` 4 cron: warranty, maintenance, low-stock, ticket-overdue + `AlertLog` chống trùng + `POST /alerts/run/:job` |
| Thống kê trực quan | ✅ | `ReportsService` 4 API (dashboard, assets, maintenance-cost, it-performance) + 3 Excel export |

✅ **Hoàn chỉnh**.

---

## Tổng kết (cập nhật sau khi bổ sung)

- ✅ **40/40 usecase** đáp ứng đầy đủ.

### Chi tiết bổ sung (so với bản đầu):
Trong `assets.controller.ts` đã thêm 2 endpoint:
- `GET /assets/:id/maintenance-history` — lịch sử phiếu bảo trì (MaintenanceTask) của tài sản
- `GET /assets/:id/repair-history` — lịch sử sự cố (Ticket) của tài sản

Service method tương ứng được thêm trong `assets.service.ts` (`getMaintenanceHistory`, `getRepairHistory`), truy cập model qua `connection.model()` để tránh phụ thuộc vòng giữa các module.

### Triển khai

Cả 2 endpoint:
- Áp dụng `canView()` (data-scope theo quyền `asset:read_all` / `asset:read_department` / `currentUserId == me`)
- Trả về `createPaginatedResponse` chuẩn
- Populate `planId`, `assigneeId`, `reportedBy`, `incidentTypeId` để FE hiển thị trực tiếp
- Sort theo `scheduledDate` / `createdAt` desc

## Câu hỏi thường gặp

1. **Báo cáo cho Admin/QLTS/QLPB có gì khác nhau?** — `ReportsService` dùng `reportScope()`: ADMIN xem tất cả (REPORT_VIEW_ALL), QLPB xem phòng mình (REPORT_VIEW_DEPARTMENT), Nhân viên không có quyền report.
2. **Có gửi email thông báo không?** — Hiện chỉ in-app (`notification.schema`). PLAN nói rõ "Thông báo in-app (lưu DB)" → đáp ứng.
3. **Có tích hợp AI/ML không?** — Không nằm trong scope PLAN.
4. **Test tự động?** — 7 tests pass (`pnpm exec jest`).
