export type AppUpdateState = {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'restarting' | 'current' | 'unavailable' | 'error';
  message: string;
};
export type AppUpdateIO = {
  enabled: boolean;
  check: () => Promise<boolean>;
  download: () => Promise<boolean>;
  reload: () => Promise<void>;
};

export function createAppUpdateController(io: AppUpdateIO, onState: (state: AppUpdateState) => void) {
  let state: AppUpdateState = { phase: 'idle', message: '' };
  let busy = false;
  const set = (phase: AppUpdateState['phase'], message: string) => {
    state = { phase, message };
    onState(state);
  };
  return {
    async check() {
      if (busy || state.phase === 'ready' || state.phase === 'restarting') return;
      if (!io.enabled) {
        set('unavailable', '이 실행 환경에서는 앱 업데이트를 사용할 수 없습니다. 설치된 앱에서 다시 확인해주세요.');
        return;
      }
      busy = true;
      set('checking', '업데이트를 확인하고 있어요.');
      try {
        if (await io.check()) set('available', '새 업데이트가 있습니다. 다운로드하시겠습니까?');
        else set('current', '현재 사용할 수 있는 최신 버전입니다.');
      } catch {
        set('error', '업데이트 확인에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.');
      } finally { busy = false; }
    },
    async download() {
      if (busy || state.phase !== 'available') return;
      busy = true;
      set('downloading', '업데이트를 다운로드하고 있어요.');
      try {
        if (await io.download()) set('ready', '다운로드가 완료됐습니다. 앱을 재시작하면 적용됩니다. 작성 중인 내용은 먼저 저장해주세요.');
        else set('current', '현재 사용할 수 있는 최신 버전입니다.');
      } catch {
        set('error', '업데이트 다운로드에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.');
      } finally { busy = false; }
    },
    async apply() {
      if (busy || state.phase !== 'ready') return;
      busy = true;
      set('restarting', '업데이트를 적용하기 위해 앱을 재시작하고 있어요.');
      try { await io.reload(); }
      catch { set('error', '앱 재시작에 실패했습니다. 앱을 완전히 종료한 뒤 다시 실행해주세요.'); }
      finally { busy = false; }
    },
    defer() {
      if (!busy && state.phase === 'available') set('idle', '');
      // Downloaded updates remain ready, so a later manual check can offer restart.
    },
  };
}
