import {
  parseMenuChatResponse,
  sanitizeMenuChatRequest,
  type MenuChatRequest,
  type MenuChatResponse,
} from '../domain/menu-chat.ts';
import { supabase } from './supabase.ts';

export async function sendMenuChat(input: MenuChatRequest): Promise<MenuChatResponse> {
  if (!supabase) throw new Error('AI 서버 연결 설정이 필요합니다.');
  const request = sanitizeMenuChatRequest(input);
  const { data, error } = await supabase.functions.invoke('menu-chat', { body: request });
  if (error) throw new Error('AI 응답을 받지 못했습니다. 잠시 후 다시 시도해주세요.');
  return parseMenuChatResponse(data);
}
