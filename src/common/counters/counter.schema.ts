import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Bộ đếm tuần tự để sinh mã chứng từ (TK-2610-0001, LT-2026-0001...) */
@Schema({ timestamps: true })
export class Counter extends Document {
  @Prop({ type: String, required: true, unique: true })
  key: string;

  @Prop({ type: Number, default: 0 })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
