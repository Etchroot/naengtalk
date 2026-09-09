import type { Usage } from '../domain/cooking.ts';
import { buildRemoteCookingRequest } from '../domain/remote-cooking.ts';
import { supabase } from './supabase.ts';

export type RemoteCookingResult = {
  status: 'completed' | 'already_completed';
  recipe_id?: string;
  cooking_session_id?: string;
  deductions?: Array<{
    lot_id: string;
    ingredient_key: string;
    quantity: number;
    unit: string;
  }>;
};

export async function completeRemoteCooking(input: {
  title: string;
  content: Record<string, unknown>;
  usage: Usage[];
  requestKey: string;
}): Promise<RemoteCookingResult> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');

  const { data, error } = await supabase.rpc(
    'complete_recipe_cooking',
    buildRemoteCookingRequest(input),
  );

  if (error) throw error;
  return data as RemoteCookingResult;
}
