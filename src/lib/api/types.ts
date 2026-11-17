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
  reminderTime: string | null; // HH:MM
};

export type UpdateSettingsRequest = {
  goalWeight: number | null; // in `unit`
  unit: WeightUnit;
  reminderTime: string | null; // HH:MM
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

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  pctChange: number | null; // negative = lost weight
  lastWeighedOn: string | null;
  weighInCount: number;
  isMe: boolean;
};
