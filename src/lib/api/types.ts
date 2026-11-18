// Request/response shapes the screens work with, kept separate from the
// database rows (as in the course's CreateEmployeeRequest / GetEmployeeResponse).
// Screens never see snake_case rows or audit columns they don't need.

import type { WeightUnit } from '../units';

export type WeighIn = {
  id: number;
  weightKg: number;
  measuredOn: string; // YYYY-MM-DD
  lastModifiedAt: string | null; // shown as "edited" in history
};

export type CreateWeighInRequest = { weight: number; unit: WeightUnit; measuredOn: string };
export type UpdateWeighInRequest = { weight: number; unit: WeightUnit };

export type ListWeighInsRequest = {
  page?: number; // 1-based, default 1
  pageSize?: number; // default 30, max 100
  from?: string; // inclusive YYYY-MM-DD
  to?: string; // inclusive YYYY-MM-DD
};

export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type MySettings = {
  displayName: string;
  goalWeightKg: number | null;
  unit: WeightUnit;
};

export type UpdateSettingsRequest = {
  goalWeight: number | null; // in `unit`
  unit: WeightUnit;
};

export type Group = {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
};

export type GroupMember = {
  userId: string;
  displayName: string;
  joinedAt: string;
};

export type LeaderboardPeriod = 'week' | 'month' | 'total';

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  currentWeightKg: number | null;
  changeKg: number | null; // negative = lost weight; null = not enough data
  pctChange: number | null;
  lastWeighedOn: string | null;
  weighInCount: number;
  isMe: boolean;
};

export type RankingCategory = 'day' | 'week' | 'month' | 'total' | 'best_day' | 'best_week' | 'best_month';
export type RankingMetric = 'kg' | 'pct';

/** One person's result in one ranking. */
export type RankingEntry = {
  category: RankingCategory;
  /** Records come once per metric (the best kg drop and the best % drop can differ); current changes serve both. */
  rankedBy: 'both' | RankingMetric;
  userId: string;
  displayName: string;
  currentWeightKg: number | null;
  changeKg: number;
  pctChange: number;
  fromDate: string;
  toDate: string;
  isMe: boolean;
};

export type GroupWeighIn = { userId: string; measuredOn: string; weightKg: number };
