import type { WeighInRow } from '../database.types';
import { supabase } from '../supabase';
import { roundKg, toKg } from '../units';
import { isValid, localToday, validatePage, validateWeighIn } from '../validation';
import { ApiError, unwrap } from './errors';
import type {
  CreateWeighInRequest,
  ListWeighInsRequest,
  Paged,
  UpdateWeighInRequest,
  WeighIn,
} from './types';

const COLUMNS = 'id, weight_kg, measured_on, last_modified_at';
const DEFAULT_PAGE_SIZE = 30;

type Row = Pick<WeighInRow, 'id' | 'weight_kg' | 'measured_on' | 'last_modified_at'>;

function toWeighIn(row: Row): WeighIn {
  return {
    id: row.id,
    weightKg: Number(row.weight_kg), // numeric columns can arrive as strings
    measuredOn: row.measured_on,
    lastModifiedAt: row.last_modified_at,
  };
}

/** Your weigh-ins, newest first, paged and optionally limited to a date range. */
export async function listWeighIns(request: ListWeighInsRequest = {}): Promise<Paged<WeighIn>> {
  const errors = validatePage(request);
  if (!isValid(errors)) throw ApiError.validation(errors);

  const page = request.page ?? 1;
  const pageSize = request.pageSize ?? DEFAULT_PAGE_SIZE;
  const start = (page - 1) * pageSize;

  // RLS already limits rows to the signed-in user.
  let query = supabase
    .from('weigh_ins')
    .select(COLUMNS, { count: 'exact' })
    .order('measured_on', { ascending: false })
    .range(start, start + pageSize - 1);

  if (request.from) query = query.gte('measured_on', request.from);
  if (request.to) query = query.lte('measured_on', request.to);

  const { data, error, count } = await query;
  const rows = unwrap<Row[]>({ data, error });
  const total = count ?? rows.length;

  return { items: rows.map(toWeighIn), page, pageSize, total, hasMore: start + rows.length < total };
}

export async function createWeighIn(
  request: CreateWeighInRequest,
  today: string = localToday(),
): Promise<WeighIn> {
  const errors = validateWeighIn(request, today);
  if (!isValid(errors)) throw ApiError.validation(errors);

  const row = unwrap<Row>(
    await supabase
      .from('weigh_ins')
      .insert({ weight_kg: roundKg(toKg(request.weight, request.unit)), measured_on: request.measuredOn })
      .select(COLUMNS)
      .single(),
  );
  return toWeighIn(row);
}

export async function updateWeighIn(id: number, request: UpdateWeighInRequest): Promise<WeighIn> {
  // Only the weight can change; the date identifies the entry.
  const errors = validateWeighIn({ ...request, measuredOn: localToday() });
  if (errors.weight) throw ApiError.validation({ weight: errors.weight });

  const { data, error } = await supabase
    .from('weigh_ins')
    .update({ weight_kg: roundKg(toKg(request.weight, request.unit)) })
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle();

  const row = unwrap<Row | null>({ data, error });
  if (!row) throw new ApiError('That weigh-in no longer exists.', 'not-found');
  return toWeighIn(row);
}

export async function deleteWeighIn(id: number): Promise<void> {
  const { data, error } = await supabase.from('weigh_ins').delete().eq('id', id).select('id');
  if (unwrap<{ id: number }[]>({ data, error }).length === 0) {
    throw new ApiError('That weigh-in no longer exists.', 'not-found');
  }
}

/** Every weigh-in from `from` (inclusive) onwards, oldest first. Pages through 100 at a time. */
export async function listAllWeighInsSince(from?: string): Promise<WeighIn[]> {
  const all: WeighIn[] = [];
  for (let page = 1; ; page++) {
    const result = await listWeighIns({ page, pageSize: 100, from });
    all.push(...result.items);
    if (!result.hasMore) break;
  }
  return all.reverse();
}

/** Your very first weigh-in (the starting point for goal progress), or null. */
export async function getFirstWeighIn(): Promise<WeighIn | null> {
  const { total } = await listWeighIns({ pageSize: 1 });
  if (total === 0) return null;
  const oldest = await listWeighIns({ page: total, pageSize: 1 });
  return oldest.items[0] ?? null;
}
