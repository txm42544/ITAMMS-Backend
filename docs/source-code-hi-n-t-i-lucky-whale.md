# PLAN: Backend "Hệ thống quản lý vòng đời tài sản CNTT & bảo trì máy tính"

## Context
- Source hiện tại (`CompanyManagementBE`) là backend NestJS mẫu cho một đề tài khác (quản lý thí nghiệm điện). Stack: NestJS 10, Mongoose 8/MongoDB, JWT/Passport, Swagger, Cloudinary, @nestjs/schedule; `exceljs` đã cài sẵn nhưng chưa dùng.
- Cần xây backend cho đề tài trong [.txt](.txt): quản lý vòng đời tài sản CNTT, mã QR, helpdesk/ticket, bảo trì định kỳ, kho linh kiện, cảnh báo tự động và dashboard, cho 5 actor (Admin, Quản lý tài sản, Kỹ thuật viên, Nhân viên, Quản lý phòng ban).
- Các lựa chọn đã chốt:
  - Giữ **MongoDB/Mongoose**.
  - Phân quyền **Role + Permission động**.
  - Thông báo **in-app** (lưu DB).
  - Lưu file trên **Cloudinary**.
- Hướng làm: giữ phần hạ tầng tốt của source mẫu, xoá toàn bộ module nghiệp vụ cũ, gom phần dùng chung vào `src/common`, rồi xây các module mới theo từng giai đoạn.

---

## 1. Tái cấu trúc khung (giữ / sửa / xoá)

**Giữ lại, chỉ chỉnh sửa:**
- `src/main.ts`:
  - Giữ prefix `api/v1`, ValidationPipe, CORS, Swagger `/docs`.
  - Bật basic-auth cho Swagger bằng `SWAGGER_USERNAME/PASSWORD` (dùng `express-basic-auth` đã có sẵn).
- `src/utils/response.util.ts` → chuyển sang `src/common/utils/response.util.ts`:
  - Giữ `createApiResponse` và `createPaginatedResponse`.
  - **Thống nhất một kiểu pagination**: `{ total, page, limit, totalPages }`.
- `src/utils/transform.interceptor.ts`, `src/exception-filter/http-exception.filter.ts` → chuyển vào `src/common/`.
- `src/activity-logs/*` (audit log qua global interceptor): giữ nguyên, đổi `ref` sang `User`.
- `src/upload/upload.service.ts` (Cloudinary): giữ nhánh Cloudinary, bỏ Backblaze/Appwrite.
- `src/auth/decorators/auth.decorators.ts`: giữ `Public`, `CurrentUser`, `GetUserId`, `RequirePermissions`.
- `src/notifications/*`: dùng làm nền cho module Notification mới (mở rộng enum `type`).

**Xoá:**
- Các module nghiệp vụ cũ: bays, partners, voltage-levels, test-*, testing-devices, job-plans, construction-logs, contracts, payment-records, attendance, work-schedules, tasks, documents, equipment, reports cũ.
- keep-alive, telegram (token đang bị hardcode trong source), `utils/notification.*` (stub).
- Có thể giữ backup nếu còn thời gian.
- Gỡ dependency `node-appwrite` và `@aws-sdk/*`.
- Thêm dependency: `qrcode` + `@types/qrcode`, `joi` (validate env), `pdfkit` (tuỳ chọn: in tem QR).

**Sửa lỗi bảo mật của khung:**
- JWT không còn fallback `'your-secret-key'`.
- Access và refresh token dùng 2 secret riêng.
- Refresh token được hash, lưu trên User và xoay vòng (rotation). Logout sẽ thu hồi token.
- `PermissionsGuard` kiểm tra thật, không cho mọi user qua như hiện tại.
- Escape regex cho các tham số search.
- `@Query() query: any` → thay bằng `PaginationQueryDto` có validate.
- `ConfigModule.forRoot({ isGlobal: true, validationSchema })`.
- `docker-compose.yml` thêm service `mongo` để chạy local.

**Cấu trúc thư mục mới:**
```
src/
  main.ts  app.module.ts
  config/            configuration.ts, env.validation.ts
  common/
    constants/       permissions.constant.ts (catalogue quyền), system-codes.ts (mã role/status hệ thống)
    decorators/      public, current-user, require-permissions
    guards/          jwt-auth.guard.ts, permissions.guard.ts (cả 2 đăng ký global qua APP_GUARD)
    interceptors/    transform.interceptor.ts
    filters/         http-exception.filter.ts
    dto/             pagination-query.dto.ts, date-range-query.dto.ts
    schemas/         base.schema.ts (createdBy, updatedBy, isActive + timestamps)
    utils/           response.util.ts, regex.util.ts, data-scope.util.ts
    counters/        counter.schema.ts + CounterService.next(key) → sinh mã tuần tự (TS-2026-0001, TK-202610-0001…)
  database/seeds/    seed.ts (role hệ thống, admin, trạng thái, loại thiết bị, dữ liệu demo)
  modules/
    auth/ users/ roles/ departments/ catalogs/ (locations, suppliers, settings)
    asset-categories/ asset-statuses/ incident-types/
    assets/ (assets + asset-history + qr) asset-requests/
    tickets/ repair-requests/ spare-parts/ (spare-parts + stock-transactions)
    maintenance/ (plans + tasks) notifications/ alerts/ (cron) reports/ upload/ activity-logs/
```
Mỗi module vẫn theo pattern của source mẫu: `schemas/`, `dto/`, `*.service.ts`, `*.controller.ts`, `*.module.ts`. Service inject Model qua `@InjectModel`. Trả về `createApiResponse`/`createPaginatedResponse`. Message tiếng Việt.

---

## 2. Phân quyền (Role + Permission động)

- **Role** `{ code, name, description, permissions: string[], isSystem }`.
  - Seed 5 role hệ thống: `ADMIN`, `ASSET_MANAGER`, `TECHNICIAN`, `EMPLOYEE`, `DEPT_MANAGER`.
  - Role có `isSystem: true` không xoá được và không đổi được `code`.
  - Admin tạo được role mới và tick chọn quyền.
- **Catalogue quyền** nằm trong code (`common/constants/permissions.constant.ts`), nhóm theo module. Ví dụ: `user:manage`, `role:manage`, `catalog:manage`, `asset:create|update|delete`, `asset:read_all|read_department|read_own`, `asset-request:create|approve_department|execute`, `ticket:create|assign|process|read_all`, `repair-request:approve`, `spare-part:manage|consume`, `maintenance:plan|execute`, `qr:manage`, `report:view_all|view_department`.
  - Endpoint `GET /permissions` trả cây quyền để FE dựng màn hình phân quyền.
- **PermissionsGuard**:
  - Lấy role của user. Nên cache vào payload JWT, hoặc cache trong memory có TTL.
  - `ADMIN` có toàn quyền (`*`).
  - Kiểm tra `@RequirePermissions(...)`.
- **Phạm vi dữ liệu (data scope)**: `data-scope.util.ts` dựa vào quyền `*_all` / `*_department` / `*_own` để thêm filter (`departmentId` hoặc `currentUserId`/`reportedBy`) vào query của assets, tickets và reports.
  - Quản lý phòng ban chỉ thấy dữ liệu phòng mình.
  - Nhân viên chỉ thấy tài sản và yêu cầu của mình.

---

## 3. Thiết kế dữ liệu (collections chính)

| Collection | Trường chính |
|---|---|
| **User** | code, fullName, username, email, password (select:false), phone, avatar, departmentId, roleId, position, isActive, lastLoginAt, refreshTokenHash |
| **Department** | code, name, parentId, managerId (User), description, isActive |
| **Location** | code, name, building, floor, room, departmentId |
| **Supplier** | code, name, contactPerson, phone, email, address |
| **Setting** | key, value, description (vd: `warrantyAlertDays=30`, `maintenanceAlertDays=7`, `ticketSlaDefaultHours`) |
| **AssetCategory** (loại thiết bị) | code, name, codePrefix (PC/LT/MN…), specFields[] (cpu, ram, storage, os…), defaultMaintenanceCycleMonths, usefulLifeYears |
| **AssetStatus** | code, name, color, order, isSystem, allowAssign, isFinal. Seed: IN_STOCK, IN_USE, UNDER_REPAIR, UNDER_MAINTENANCE, BROKEN, LOST, DISPOSED |
| **IncidentType** | code, name, defaultPriority, slaHours, description |
| **Asset** | assetCode (tự sinh), name, categoryId, brand, model, serialNumber (unique), specs (Map), supplierId, purchaseDate, purchasePrice, invoiceNumber, warrantyStartDate, warrantyEndDate, statusId, departmentId, locationId, currentUserId, assignedAt, qrToken (unique), maintenanceCycleMonths, lastMaintenanceDate, nextMaintenanceDate, images[], attachments[], notes, disposedAt, disposalInfo |
| **AssetHistory** | assetId, action (CREATED, UPDATED, ASSIGNED, HANDED_OVER, RETURNED, TRANSFERRED, STATUS_CHANGED, REPAIRED, MAINTAINED, PART_REPLACED, DISPOSED, QR_REGENERATED), from/to (user, department, location, status), refType/refId, description, changes, performedBy |
| **AssetRequest** (yêu cầu vòng đời) | code, type (ALLOCATION, HANDOVER, RETURN, TRANSFER, DISPOSAL), assetIds[], requestedBy, fromDepartmentId, toDepartmentId, fromUserId, toUserId, reason, status (PENDING, APPROVED, REJECTED, COMPLETED, CANCELLED), approvals[{step, departmentId, approverId, decision, note, at}], executedBy, executedAt, attachments |
| **Ticket** (sự cố) | code, assetId, reportedBy, departmentId (snapshot), source (WEB/QR), title, description, images[], incidentTypeId, priority (LOW…CRITICAL), status, assigneeId, assignedBy, dueAt (theo SLA), diagnosis, resolution, rootCause, partsUsed[{sparePartId, qty, unitCost}], laborCost, externalCost, totalCost, acceptance{accepted, rating, feedback, at}, timeline[{status, by, note, at}], receivedAt, startedAt, resolvedAt, closedAt |
| **RepairRequest** (đề xuất sửa/thay cần duyệt) | code, ticketId, assetId, type (EXTERNAL_REPAIR, REPLACE_PART, REPLACE_DEVICE, UPGRADE), items[{sparePartId?, description, qty, estimatedCost}], estimatedCost, reason, status (PENDING, APPROVED, REJECTED), proposedBy, approvedBy, decisionNote |
| **SparePart** | code, name, unit, compatibleCategoryIds[], specs, quantity, minQuantity, unitPrice, supplierId, storageLocation |
| **StockTransaction** | code, type (IMPORT, EXPORT_TICKET, EXPORT_MAINTENANCE, ADJUST, RETURN), sparePartId, quantity, unitPrice, balanceAfter, refType/refId, note, performedBy |
| **MaintenancePlan** | code, name, scope{categoryIds, departmentIds, assetIds}, intervalValue + intervalUnit (DAY/WEEK/MONTH), startDate, nextRunDate, leadDays, checklist[{item, required}], defaultAssigneeId, isActive |
| **MaintenanceTask** | code, planId, assetId, scheduledDate, assigneeId, status (SCHEDULED, IN_PROGRESS, COMPLETED, OVERDUE, SKIPPED, CANCELLED), checklistResults[{item, ok, note}], result, conditionAfter, partsUsed[], cost, images[], startedAt, completedAt |
| **Notification** | userId, type, title, content, refType, refId, isRead, readAt |
| **AlertLog** | dedupeKey (unique), type, refId, sentAt. Chống gửi trùng cảnh báo |
| **Counter** | key (unique), seq. Sinh mã tuần tự |

Các nguyên tắc chung:
- Soft delete bằng `isActive`.
- Index cho các trường hay lọc: statusId, departmentId, currentUserId, warrantyEndDate, nextMaintenanceDate, ticket status/assigneeId.
- **Tồn kho**: trừ kho bằng `findOneAndUpdate({_id, quantity: {$gte: qty}}, {$inc: {quantity: -qty}})` để không bao giờ âm kho, không cần replica-set transaction. Sau đó ghi StockTransaction.

---

## 4. Luồng nghiệp vụ & state machine

**Vòng đời tài sản** (mọi thay đổi đều gọi `AssetHistoryService.log()`):
- Mua mới → tạo Asset (trạng thái IN_STOCK, sinh `assetCode` + `qrToken`).
- **Cấp phát (ALLOCATION)**:
  1. Quản lý tài sản (QLTS) tạo yêu cầu, chọn phòng ban/người nhận.
  2. Quản lý phòng ban nhận duyệt (`approve_department`).
  3. QLTS thực hiện (`execute`): asset chuyển IN_USE, cập nhật departmentId/currentUserId.
- **Bàn giao / Thu hồi (HANDOVER / RETURN)**: QLPB duyệt → QLTS thực hiện. Với RETURN, asset về IN_STOCK và xoá currentUserId.
- **Điều chuyển (TRANSFER)**: 2 bước duyệt (QLPB phòng đi → QLPB phòng nhận) → QLTS thực hiện.
- **Thanh lý (DISPOSAL)**: QLTS (hoặc Admin) duyệt → asset chuyển DISPOSED (isFinal), khoá mọi thao tác sau đó.
- Validate: chỉ cấp phát asset có status `allowAssign`; không thao tác trên asset `isFinal`; một asset không được có 2 yêu cầu PENDING cùng lúc.

**Ticket (helpdesk)**:
```
NEW → RECEIVED (KTV tiếp nhận, phân loại incidentType/priority, tính dueAt)
    → ASSIGNED (giao KTV) → IN_PROGRESS (kiểm tra, ghi diagnosis)
    → [PENDING_APPROVAL ⇄ RepairRequest được duyệt/từ chối] → IN_PROGRESS
    → RESOLVED (ghi kết quả, linh kiện, chi phí) → CLOSED (người báo nghiệm thu + đánh giá)
                                                 → REOPENED (không đạt) → IN_PROGRESS
NEW/RECEIVED → CANCELLED (người báo huỷ / KTV từ chối)
```
- Tập chuyển trạng thái hợp lệ định nghĩa bằng bảng `TICKET_TRANSITIONS`. Mỗi lần chuyển đẩy vào `timeline` và gửi notification cho các bên liên quan.
- Khi IN_PROGRESS: asset chuyển UNDER_REPAIR. Khi RESOLVED/CLOSED: trả asset về trạng thái trước đó và ghi history REPAIRED.
- Linh kiện dùng trong ticket sẽ trừ kho (StockTransaction EXPORT_TICKET) và cộng vào totalCost.

**Bảo trì định kỳ**:
- QLTS tạo MaintenancePlan.
- Cron hằng ngày sinh MaintenanceTask cho các asset đến hạn (`nextMaintenanceDate - leadDays <= today`).
- KTV thực hiện: điền checklist, linh kiện, kết quả.
- Khi COMPLETED: cập nhật `lastMaintenanceDate`, `nextMaintenanceDate`, ghi history MAINTAINED.
- Task quá hạn chuyển OVERDUE.

---

## 5. API chính (REST, prefix `/api/v1`, mapping theo use case)

| Actor / Use case | Endpoint |
|---|---|
| Đăng nhập | `POST /auth/login`, `POST /auth/refresh-token`, `POST /auth/logout`, `GET/PUT /auth/me`, `PUT /auth/change-password` |
| Admin: Tài khoản & phân quyền | `CRUD /users`, `PATCH /users/:id/status`, `PATCH /users/:id/reset-password`, `CRUD /roles`, `GET /permissions` |
| Admin: Danh mục hệ thống | `CRUD /locations`, `/suppliers`, `GET/PUT /settings` |
| Admin: Phòng ban / Loại thiết bị / Loại sự cố / Trạng thái | `CRUD /departments`, `/asset-categories`, `/incident-types`, `/asset-statuses` |
| QLTS: Thông tin tài sản | `CRUD /assets` (lọc theo category, status, department, user, warranty, search), `POST /assets/import`, `GET /assets/export` (Excel) |
| QLTS: Vòng đời / Lịch sử | `CRUD /asset-requests`, `POST /asset-requests/:id/approve`, `/reject`, `/execute`, `/cancel`, `GET /assets/:id/history` |
| QLTS: QR Code | `GET /assets/:id/qr` (PNG/base64), `POST /assets/qr/batch` (in tem hàng loạt), `POST /assets/:id/qr/regenerate` |
| Quét QR (KTV, Nhân viên) | `GET /qr/:token` (auth tuỳ chọn: chưa đăng nhập thì trả info rút gọn, đã đăng nhập thì trả chi tiết theo quyền) |
| QLTS: Bảo trì định kỳ | `CRUD /maintenance-plans`, `GET /maintenance-tasks`, `POST /maintenance-plans/:id/generate` |
| QLTS: Duyệt sửa chữa/thay thế | `GET /repair-requests`, `POST /repair-requests/:id/approve` / `reject` |
| QLTS: Kho linh kiện | `CRUD /spare-parts`, `POST /spare-parts/:id/import`, `POST /spare-parts/:id/adjust`, `GET /stock-transactions`, `GET /spare-parts/low-stock` |
| KTV: Ticket | `GET /tickets` (lọc assignee=me / chưa giao), `POST /tickets/:id/receive`, `/assign`, `/start`, `PUT /tickets/:id/diagnosis`, `POST /tickets/:id/parts`, `POST /tickets/:id/resolve`, `POST /tickets/:id/repair-requests` |
| KTV: Bảo trì | `POST /maintenance-tasks/:id/start`, `/complete`, `GET /assets/:id/maintenance-history`, `GET /assets/:id/repair-history` |
| Nhân viên | `GET /me/assets`, `POST /tickets` (có thể kèm `assetId` từ QR, ảnh), `GET /tickets/my`, `POST /tickets/:id/accept`, `/reopen`, `/cancel`, `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notifications/unread-count` |
| QLPB | Dùng chung `/assets`, `/tickets`, `/maintenance-tasks` (tự lọc theo phòng nhờ data scope), `GET /asset-requests?pendingMyApproval=true`, `GET /reports/department` |
| Báo cáo / Dashboard | `GET /reports/dashboard`, `/reports/assets` (theo trạng thái, loại, phòng ban, tuổi thiết bị, bảo hành còn/sắp hết/hết, tổng giá trị), `/reports/maintenance-cost` (theo tháng, loại, phòng ban, top tài sản tốn kém; tách linh kiện/nhân công/thuê ngoài), `/reports/it-performance` (số ticket, thời gian phản hồi/xử lý TB, tỉ lệ đúng SLA, thống kê theo KTV, điểm đánh giá TB), `GET /reports/*/export` (Excel) |
| Upload | `POST /upload/image` (Cloudinary, giữ từ source mẫu) |

Tài liệu API viết theo format của [API_Documentation_Sample.txt](API_Documentation_Sample.txt): envelope `{ statusCode, message, data, meta }`, list thêm `pagination`.

---

## 6. Cảnh báo tự động (`alerts` module, @nestjs/schedule)

| Cron | Việc |
|---|---|
| 07:00 hằng ngày | Tìm tài sản có bảo hành hết trong `warrantyAlertDays` ngày (hoặc đã hết) → notify QLTS |
| 00:30 hằng ngày | Sinh MaintenanceTask từ các plan đến hạn → notify KTV được giao. Task quá hạn → OVERDUE + notify KTV & QLTS |
| 07:00 hằng ngày | Linh kiện có `quantity <= minQuantity` → notify QLTS |
| Mỗi giờ | Ticket quá `dueAt` mà chưa RESOLVED → notify KTV & QLTS |

- Mọi cảnh báo đi qua `AlertLog.dedupeKey` (vd `WARRANTY:<assetId>:<warrantyEndDate>`) để không gửi trùng.
- Gửi qua `NotificationService.notifyUsers()` / `notifyRole(roleCode)`.
- Có thêm endpoint `POST /alerts/run/:job` (admin) để chạy tay khi demo.

---

## 7. Lộ trình triển khai (theo giai đoạn)

1. **GĐ0: Dọn khung**
   - Xoá module cũ, tạo `common/`, `config/`, sửa bảo mật, thêm service mongo trong docker-compose.
   - Viết `CounterService` và `PaginationQueryDto`.
   - Viết seed (`pnpm seed`): role, admin, trạng thái, loại thiết bị.
2. **GĐ1: Auth + Users + Roles/Permissions + Activity log**
   - Guard global, data scope.
3. **GĐ2: Danh mục**
   - departments, locations, suppliers, settings, asset-categories, asset-statuses, incident-types.
4. **GĐ3: Tài sản**
   - Assets CRUD, AssetHistory, QR (qrcode), upload ảnh, import/export Excel (exceljs).
5. **GĐ4: Vòng đời**
   - AssetRequest với các luồng duyệt (cấp phát, bàn giao, thu hồi, điều chuyển, thanh lý).
6. **GĐ5: Kho linh kiện**
   - SparePart + StockTransaction (nhập, xuất, điều chỉnh, cảnh báo tồn thấp).
7. **GĐ6: Helpdesk**
   - Ticket state machine, RepairRequest + duyệt, nghiệm thu, tích hợp trừ kho và chi phí.
8. **GĐ7: Bảo trì + Thông báo + Cron cảnh báo**
9. **GĐ8: Báo cáo/Dashboard**
   - Aggregation pipelines, export Excel.
10. **GĐ9: Hoàn thiện**
    - Seed dữ liệu demo đầy đủ cho 5 role.
    - Unit test các phần quan trọng.
    - Swagger đầy đủ, viết file tài liệu API.

---

## 8. Verification
- `pnpm install && pnpm build` không lỗi; `pnpm lint`.
- `docker compose up -d mongo`, sau đó `pnpm seed`, sau đó `pnpm start:dev`. Mở `http://localhost:5000/docs` (basic auth).
- **Unit test (jest)**:
  - Bảng chuyển trạng thái ticket và asset-request (chuyển sai thì ném lỗi).
  - Trừ kho không âm.
  - `CounterService` sinh mã không trùng.
  - Tính `nextMaintenanceDate`.
  - Data scope theo role.
- **Kịch bản E2E thủ công trên Swagger/Postman**, mỗi bước đăng nhập đúng role:
  1. Admin tạo phòng ban, user cho 5 role, loại thiết bị.
  2. QLTS tạo laptop, lấy QR. Tạo yêu cầu cấp phát → QLPB duyệt → QLTS thực hiện. Asset IN_USE, history có ASSIGNED.
  3. Nhân viên quét `GET /qr/:token` rồi báo sự cố → KTV nhận notification, tiếp nhận, kiểm tra, tạo RepairRequest → QLTS duyệt → KTV dùng linh kiện (kho giảm), resolve → nhân viên nghiệm thu (CLOSED).
  4. Tạo MaintenancePlan, gọi `POST /alerts/run/maintenance` → sinh task → KTV hoàn thành → `nextMaintenanceDate` được cập nhật.
  5. Sửa `warrantyEndDate` thành 10 ngày tới, chạy job warranty → QLTS có notification, chạy lại không bị trùng.
  6. Kiểm tra `/reports/dashboard`, `/reports/maintenance-cost`, `/reports/it-performance` có số liệu khớp. QLPB chỉ thấy dữ liệu phòng mình.
