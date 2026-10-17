import { CounterService } from './counter.service';

describe('CounterService (format)', () => {
  it('formatPeriod YEAR trả về năm hiện tại', () => {
    const year = new Date().getFullYear();
    expect(CounterService.formatPeriod(new Date(2026, 5, 1), 'YEAR')).toBe(
      '2026',
    );
    expect(year).toBeGreaterThan(2025);
  });

  it('formatPeriod MONTH trả về YYMM', () => {
    expect(CounterService.formatPeriod(new Date(2026, 0, 1), 'MONTH')).toBe(
      '2601',
    );
    expect(CounterService.formatPeriod(new Date(2026, 10, 30), 'MONTH')).toBe(
      '2611',
    );
  });

  it('formatPeriod không truyền → trả về chuỗi rỗng', () => {
    expect(CounterService.formatPeriod(new Date())).toBe('');
  });
});
