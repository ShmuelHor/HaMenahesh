import { Schema, model, Document } from 'mongoose';
import { IPrediction } from '../types';

export type PredictionDocument = IPrediction & Document;

const PredictionSchema = new Schema<PredictionDocument>(
  {
    matchId: { type: String, required: true, unique: true, index: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    homeFlag: { type: String, default: '' },
    awayFlag: { type: String, default: '' },
    matchDate: { type: Date, required: true, index: true },
    venue: { type: String, default: '' },
    stage: { type: String, default: '' },
    group: { type: String, default: null },
    homeRank: { type: Number, default: 0 },
    awayRank: { type: Number, default: 0 },
    predictedHome: { type: Number, required: true },
    predictedAway: { type: Number, required: true },
    confidence: { type: Number, required: true },
    reasoning: { type: String, required: true },
    actualHome: { type: Number },
    actualAway: { type: Number },
    resultFetched: { type: Boolean, default: false, index: true },
    isCorrectWinner: { type: Boolean },
    isExactScore: { type: Boolean },
    preMatchNotified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);


PredictionSchema.index({ matchDate: 1, resultFetched: 1 });

export const Prediction = model<PredictionDocument>('Prediction', PredictionSchema);
