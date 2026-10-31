/* Personal-only font loader. Fonts stay in the current browser's IndexedDB.
   No network requests, uploads, source repository files or analytics. */
(() => {
  'use strict';
  const DB_NAME = 'splat-seed-personal-fonts-v1';
  const STORE = 'fontFiles';
  const LIMIT = 30 * 1024 * 1024; // Allow larger Korean CJK font files.
  const SLOTS = Object.freeze({
    enBold: {name: '영문 제목', family: 'SplatPersonalEnBold', variable: '--font-loaded-english-display'},
    enMain: {name: '영문 일반', family: 'SplatPersonalEnMain', variable: '--font-loaded-english-main'},
    koTitle: {name: '한글 제목', family: 'SplatPersonalKoTitle', variable: '--font-loaded-korean-display'},
    koBody: {name: '한글 본문', family: 'SplatPersonalKoBody', variable: '--font-loaded-korean-body'}
  });
  const status = document.getElementById('personalFontStatus');
  const items = document.getElementById('personalFontItems');
  const clearButton = document.getElementById('clearPersonalFonts');
  if (!status || !items || !clearButton) return;
  const setStatus = (message) => { status.textContent = message; };
  const applied = new Map();
  let database = null;
  const openDatabase = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('이 브라우저는 로컬 폰트 저장을 지원하지 않습니다.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => reject(new Error('다른 탭에서 사용 중입니다. 다른 SPLAT SEED 탭을 닫아 주세요.'));
  });
  const transaction = (kind, mode, key, value) => new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = kind === 'put' ? store.put(value, key) : kind === 'get' ? store.get(key) : store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
  const read = key => transaction('get', 'readonly', key);
  const save = (key, value) => transaction('put', 'readwrite', key, value);
  const reset = () => transaction('clear', 'readwrite');

  async function loadFont(slot, blob, filename) {
    if (!(blob instanceof Blob)) throw Error('저장된 폰트 데이터가 손상되었습니다.');
    const bytes = await blob.arrayBuffer();
    const config = SLOTS[slot];
    const font = new FontFace(config.family, bytes, {weight: '400', style: 'normal'});
    const loaded = await font.load();
    if (applied.has(slot)) document.fonts.delete(applied.get(slot));
    document.fonts.add(loaded);
    applied.set(slot, loaded);
    document.documentElement.style.setProperty(config.variable, "'" + config.family + "'");
    const state = document.querySelector('[data-font-state="' + slot + '"]');
    if (state) state.textContent = filename + ' · 적용됨';
  }

  for (const [slot, config] of Object.entries(SLOTS)) {
    const row = document.createElement('div');
    row.className = 'personal-font-row';
    const label = document.createElement('label');
    label.htmlFor = 'personal-font-' + slot;
    label.textContent = config.name;
    const input = document.createElement('input');
    input.id = label.htmlFor;
    input.type = 'file';
    input.accept = '.otf,.ttf,.woff,.woff2,font/otf,font/ttf,font/woff,font/woff2';
    input.setAttribute('aria-label', config.name + ' 글꼴 파일 선택');
    const message = document.createElement('span');
    message.dataset.fontState = slot;
    message.textContent = '기본 폰트 사용 중';
    row.append(label, input, message);
    items.append(row);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (!/\.(otf|ttf|woff2?)$/i.test(file.name)) throw Error('OTF, TTF, WOFF, WOFF2 파일만 지원합니다.');
        if (file.size === 0 || file.size > LIMIT) throw Error('폰트는 파일당 30MB 이하여야 합니다.');
        await loadFont(slot, file, file.name);
        if (database) {
          try { await save(slot, {blob: file, filename: file.name}); setStatus('이 브라우저에 개인 폰트가 저장되었습니다.'); }
          catch { setStatus('폰트는 적용했지만 브라우저 저장 공간 때문에 다음 방문 시 다시 선택해야 합니다.'); }
        } else {
          setStatus('현재 화면에 적용했습니다. 이 브라우저에서는 저장할 수 없습니다.');
        }
      } catch (error) {
        setStatus('폰트 적용 실패: ' + (error?.message || String(error)));
      } finally { input.value = ''; }
    });
  }
  clearButton.addEventListener('click', async () => {
    if (!confirm('이 브라우저에 저장한 개인 글꼴을 모두 지울까요? 뽑기 기록은 그대로 유지됩니다.')) return;
    try {
      if (database) await reset();
      for (const [slot, face] of applied) {
        document.fonts.delete(face);
        document.documentElement.style.removeProperty(SLOTS[slot].variable);
        const state = document.querySelector('[data-font-state="' + slot + '"]');
        if (state) state.textContent = '기본 폰트 사용 중';
      }
      applied.clear();
      setStatus('저장한 개인 폰트를 지웠습니다. 기본 글꼴로 돌아갔습니다.');
    } catch (error) { setStatus('초기화 실패: ' + (error?.message || String(error))); }
  });
  (async () => {
    try {
      database = await openDatabase();
      let count = 0;
      for (const slot of Object.keys(SLOTS)) {
        const saved = await read(slot);
        if (!saved) continue;
        try { await loadFont(slot, saved.blob, saved.filename); count++; }
        catch (error) { console.warn('Local font load failed:', slot, error.message); }
      }
      setStatus(count ? count + '개 개인 글꼴을 이 브라우저에서 불러왔습니다.' : '글꼴 파일은 외부 서버로 전송되지 않습니다.');
    } catch {
      setStatus('브라우저 보안 설정에 따라 글꼴 저장이 제한됩니다. 파일은 현재 화면에만 적용할 수 있습니다.');
    }
  })();
})();
