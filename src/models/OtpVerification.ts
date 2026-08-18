import mongoose, { Schema, Document } from 'mongoose';

export type OtpPurpose = 'REGISTER' | 'UPDATE_EMAIL';

export interface IOtpVerification extends Document {
  email: string;
  otp: string;
  purpose: OtpPurpose;
  createdAt: Date;
}

const OtpVerificationSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['REGISTER', 'UPDATE_EMAIL'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL index to automatically delete OTP documents after 10 minutes (600 seconds)
OtpVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

export const OtpVerification = mongoose.model<IOtpVerification>('OtpVerification', OtpVerificationSchema);
