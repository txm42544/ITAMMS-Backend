import {
  assertTransition,
  canTransition,
  TICKET_TRANSITIONS,
  TICKET_STATUS_LABEL,
} from './ticket-workflow';
import { TicketStatus } from './schemas/ticket.schema';

describe('Ticket workflow', () => {
  it('TICKET_STATUS_LABEL đủ 9 trạng thái', () => {
    expect(Object.keys(TICKET_STATUS_LABEL)).toHaveLength(9);
    expect(TICKET_STATUS_LABEL[TicketStatus.NEW]).toBe('Mới');
    expect(TICKET_STATUS_LABEL[TicketStatus.CLOSED]).toBe('Đã nghiệm thu');
  });

  it('Bảng chuyển trạng thái cho phép các thao tác đúng quy tắc', () => {
    expect(canTransition('receive', TicketStatus.NEW)).toBe(true);
    expect(canTransition('receive', TicketStatus.RESOLVED)).toBe(false);
    expect(canTransition('start', TicketStatus.ASSIGNED)).toBe(true);
    expect(canTransition('start', TicketStatus.CLOSED)).toBe(false);
    expect(canTransition('accept', TicketStatus.RESOLVED)).toBe(true);
    expect(canTransition('reopen', TicketStatus.RESOLVED)).toBe(true);
    expect(canTransition('cancel', TicketStatus.NEW)).toBe(true);
    expect(canTransition('cancel', TicketStatus.IN_PROGRESS)).toBe(false);
  });

  it('Tất cả action trong TICKET_TRANSITIONS có entry', () => {
    expect(Object.keys(TICKET_TRANSITIONS).sort()).toEqual(
      [
        'accept',
        'assign',
        'cancel',
        'diagnose',
        'note',
        'receive',
        'reopen',
        'requestRepair',
        'resolve',
        'start',
        'useParts',
      ].sort(),
    );
  });

  it('assertTransition ném lỗi khi chuyển sai', () => {
    expect(() => assertTransition('receive', TicketStatus.CLOSED)).toThrow(
      /Không thể tiếp nhận/,
    );
  });
});
