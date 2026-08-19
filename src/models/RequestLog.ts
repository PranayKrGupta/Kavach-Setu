import mongoose, { Schema, Document } from 'mongoose';

export interface IRequestLog extends Document {
  proxySlug: string;
  endpoint: string;
  method?: string;
  status: number;
  timestamp: Date;
}

const RequestLogSchema: Schema = new Schema({
  proxySlug: { type: String, required: true, index: true },
  endpoint: { type: String, required: true },
  method: { type: String, default: 'GET' },
  status: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Compound index for efficient sliding window count and metric queries
RequestLogSchema.index({ proxySlug: 1, timestamp: -1 });

// TTL index to automatically delete logs older than 7 days
RequestLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const RequestLog = mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);
