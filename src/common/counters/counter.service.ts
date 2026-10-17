import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter } from './counter.schema';

export interface CodeOptions {
  /** Chèn kỳ vào mã: YEAR → 2026, MONTH → 2610 */
  period?: 'YEAR' | 'MONTH';
  /** Số chữ số của phần tuần tự (mặc định 4) */
  pad?: number;
}

@Injectable()
export class CounterService {
  constructor(
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
  ) {}

  /** Tăng và trả về số thứ tự kế tiếp của key (atomic) */
  async next(key: string): Promise<number> {
    const counter = await this.counterModel.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    return counter.seq;
  }

  /**
   * Sinh mã dạng PREFIX-KỲ-0001 hoặc PREFIX-0001.
   * Bộ đếm reset theo kỳ (mỗi năm / mỗi tháng một key riêng).
   */
  async nextCode(prefix: string, options: CodeOptions = {}): Promise<string> {
    const period = CounterService.formatPeriod(new Date(), options.period);
    const base = period ? `${prefix}-${period}` : prefix;
    const seq = await this.next(base);
    return `${base}-${String(seq).padStart(options.pad ?? 4, '0')}`;
  }

  static formatPeriod(date: Date, period?: 'YEAR' | 'MONTH'): string {
    if (period === 'YEAR') return String(date.getFullYear());
    if (period === 'MONTH') {
      return `${String(date.getFullYear()).slice(2)}${String(
        date.getMonth() + 1,
      ).padStart(2, '0')}`;
    }
    return '';
  }
}
