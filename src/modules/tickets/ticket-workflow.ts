import { BadRequestException } from '@nestjs/common';
import { TicketStatus } from './schemas/ticket.schema';

export type TicketAction =
  | 'receive'
  | 'assign'
  | 'start'
  | 'note'
  | 'diagnose'
  | 'useParts'
  | 'requestRepair'
  | 'resolve'
  | 'accept'
  | 'reopen'
  | 'cancel';

const S = TicketStatus;

/** Bảng chuyển trạng thái hợp lệ: thao tác → các trạng thái được phép thực hiện */
export const TICKET_TRANSITIONS: Record<TicketAction, TicketStatus[]> = {
  receive: [S.NEW],
  assign: [S.NEW, S.RECEIVED, S.ASSIGNED, S.IN_PROGRESS, S.REOPENED],
  start: [S.ASSIGNED, S.REOPENED],
  note: [
    S.NEW,
    S.RECEIVED,
    S.ASSIGNED,
    S.IN_PROGRESS,
    S.PENDING_APPROVAL,
    S.REOPENED,
  ],
  diagnose: [S.IN_PROGRESS],
  useParts: [S.IN_PROGRESS],
  requestRepair: [S.IN_PROGRESS],
  resolve: [S.IN_PROGRESS],
  accept: [S.RESOLVED],
  reopen: [S.RESOLVED],
  cancel: [S.NEW, S.RECEIVED],
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  [S.NEW]: 'Mới',
  [S.RECEIVED]: 'Đã tiếp nhận',
  [S.ASSIGNED]: 'Đã phân công',
  [S.IN_PROGRESS]: 'Đang xử lý',
  [S.PENDING_APPROVAL]: 'Chờ duyệt đề xuất',
  [S.RESOLVED]: 'Đã xử lý',
  [S.CLOSED]: 'Đã nghiệm thu',
  [S.REOPENED]: 'Mở lại',
  [S.CANCELLED]: 'Đã huỷ',
};

const ACTION_LABEL: Record<TicketAction, string> = {
  receive: 'tiếp nhận',
  assign: 'phân công',
  start: 'bắt đầu xử lý',
  note: 'cập nhật tiến độ',
  diagnose: 'ghi nhận kiểm tra',
  useParts: 'cập nhật vật tư',
  requestRepair: 'tạo đề xuất sửa chữa / thay thế',
  resolve: 'ghi nhận kết quả xử lý',
  accept: 'nghiệm thu',
  reopen: 'mở lại',
  cancel: 'huỷ',
};

export function canTransition(action: TicketAction, status: TicketStatus) {
  return TICKET_TRANSITIONS[action].includes(status);
}

export function assertTransition(action: TicketAction, status: TicketStatus) {
  if (!canTransition(action, status)) {
    throw new BadRequestException(
      `Không thể ${ACTION_LABEL[action]} khi sự cố đang ở trạng thái "${TICKET_STATUS_LABEL[status]}"`,
    );
  }
}
