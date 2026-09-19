import type { Usage } from '../domain/cooking.ts';
import { buildRemoteCookingRequest } from '../domain/remote-cooking.ts';
import { supabase } from './supabase.ts';

export type RemoteCookingResult = {
  status: 'completed' | 'already_completed';
  recipe_id?: string;
  shared_recipe_id?: string;
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
  shareAfterCompletion?: boolean;
}): Promise<RemoteCookingResult> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');

  const { data, error } = await supabase.rpc(
    'complete_recipe_cooking_shared',
    buildRemoteCookingRequest(input),
  );

  if (error) throw error;
  return data as RemoteCookingResult;
}

export async function shareCompletedAiRecipe(recipeId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
  const { data, error } = await supabase.rpc('share_completed_ai_recipe', { target_recipe_id: recipeId });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('공유 결과를 확인하지 못했습니다.');
  return data;
}
