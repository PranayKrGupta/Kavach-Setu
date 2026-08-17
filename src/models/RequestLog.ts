import mongoose, { Schema, Document } from 'mongoose';

export interface IRequestLog extends Document {
  apiKeyId: string;
  endpoint: string;
  status: number;
  timestamp: Date;
}

const RequestLogSchema: Schema = new Schema({
  apiKeyId: { type: String, required: true, index: true },
  endpoint: { type: String, required: true },
  status: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

// TTL index to automatically delete logs older than 7 days
RequestLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const RequestLog = mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);
