(function () {
  'use strict';
  const $ = id => document.getElementById(id), lib = window.AIVAULTEbook;
  const endpoint = lib.INGEST + '?feature=tronclass-sync';
  let session = '', courses = [], account = '', stopped = false, busy = false, syncing = false;
  const errors = {
    AIVAULT_LOGIN_REQUIRED: '請先登入 AIVAULT，或重新登入後再試。', OWNER_ONLY: '此功能目前限 AIVAULT 擁有者／管理者使用。',
    SCHOOL_LOGIN_REQUIRED: '東吳登入未成功或已失效，請重新載入驗證碼並登入。', SESSION_EXPIRED: '連線已過期，請重新登入東吳。',
    LOGIN_FORM_CHANGED: '東吳登入頁格式有變動，尚無法處理，請勿重複送出密碼。',
    CAPTCHA_LAYOUT_CHANGED: '驗證碼格式有變動，需要調整登入連接程式。',
    FILE_TOO_LARGE: '檔案超過 15 MB，尚未匯入。', REFERENCE_RESPONSE_CHANGED: '教材清單格式需調整，未匯入不完整清單。',
    TRONCLASS_REQUEST_FAILED: '東吳連線逾時或回應無法辨識，請重試。', DOWNLOAD_NOT_A_DOCUMENT: '取得的是登入頁或錯誤回應，未當成教材匯入。'
  };
  function status(text) { $('status').textContent = text; }
  async function api(action, values = {}, binary = false) {
    const token = lib.userToken();
    if (!token) throw new Error(errors.AIVAULT_LOGIN_REQUIRED);
    let response;
    try {
      response = await fetch(endpoint, { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', apikey: lib.ANON_KEY, Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action, session, ...values }), signal: AbortSignal.timeout(90000) });
    } catch { throw new Error('同步後端尚未就緒，或網路連線失敗；尚未確認成功，請稍後重試。'); }
    if (binary && response.ok) {
      session = response.headers.get('X-Tronclass-Session') || session;
      return response.blob();
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(errors[data.error] || '連線未成功：' + (data.error || response.status));
    session = data.session || session;
    return data;
  }
  async function hash(bytes) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function removeLocalVersion(id) {
    const db = await lib.openDb();
    // The shared deleteLocalBook helper contacts the cloud. These imports are local only.
    await new Promise((resolve, reject) => {
      const names = ['books', 'files', 'pages', 'bookmarks', 'notes', 'progress'];
      const tx = db.transaction(names, 'readwrite');
      for (const name of ['books', 'files', 'progress']) tx.objectStore(name).delete(id);
      for (const name of ['pages', 'bookmarks', 'notes']) {
        const request = tx.objectStore(name).openCursor();
        request.onsuccess = () => { const cursor = request.result; if (!cursor) return;
          if (cursor.value.book_id === id) cursor.delete(); cursor.continue(); };
      }
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    lib.removeFromShelf(id);
  }
  async function run(button, fn) {
    if (busy) return; busy = true; button.disabled = true; $('prepare').disabled = true; $('clear').disabled = true;
    try { await fn(); } catch (error) { status(error.message); }
    finally { busy = false; button.disabled = false; $('prepare').disabled = false; $('clear').disabled = false; }
  }
  function semesterName(course) {
    const s = course.semester;
    return typeof s === 'object' && s ? String(s.name || s.id || '未分類學期') : String(s || '未分類學期');
  }
  function selectedCourses() { return courses.filter(c => !$('semester').value || semesterName(c) === $('semester').value); }
  function renderCourses() {
    $('course').replaceChildren();
    for (const c of selectedCourses()) $('course').add(new Option(c.name || String(c.id), String(c.id)));
    if ($('course').options.length) $('course').add(new Option('同步以上全部課程', '*'));
    $('sync').disabled = !$('course').options.length;
  }
  $('semester').onchange = renderCourses;
  $('prepare').onclick = () => run($('prepare'), async () => {
    $('schoolForm').hidden = true; $('syncCard').hidden = true; session = ''; $('password').value = ''; $('captcha').value = '';
    status('檢查同步後端並載入東吳登入頁…');
    await api('health');
    const data = await api('prepare');
    $('captchaGroup').hidden = !data.captcha; $('captcha').required = !!data.captcha;
    if (data.captcha) $('captchaImage').src = data.captcha;
    $('schoolForm').hidden = false; status('已連上東吳登入頁。請填寫學號、密碼及驗證碼。');
  });
  $('schoolForm').onsubmit = event => {
    event.preventDefault();
    run($('login'), async () => {
      const username = $('student').value.trim(), password = $('password').value;
      $('password').value = ''; status('驗證東吳登入，並讀取課程…');
      try { await api('login', { username, password, captcha: $('captcha').value.trim() }); }
      catch (error) { session = ''; $('schoolForm').hidden = true; throw error; }
      account = await hash(new TextEncoder().encode(username));
      const data = await api('courses'); courses = data.courses;
      $('semester').replaceChildren(new Option('全部學期', ''));
      for (const semester of [...new Set(courses.map(semesterName))]) $('semester').add(new Option(semester, semester));
      renderCourses(); $('schoolForm').reset(); $('schoolForm').hidden = true; $('syncCard').hidden = false;
      status('登入已驗證，取得 ' + courses.length + ' 門課。請先選一門課同步測試。');
    });
  };
  $('clear').onclick = () => {
    if (syncing) return;
    session = ''; courses = []; account = ''; $('schoolForm').reset(); $('schoolForm').hidden = true;
    $('captchaImage').removeAttribute('src'); $('syncCard').hidden = true;
    status('已清除本頁持有的東吳登入狀態；學校端 session 會依其規則到期。已匯入教材保留。');
  };
  $('stop').onclick = () => { stopped = true; status('將在目前這份教材處理完成後停止。'); };
  $('sync').onclick = () => run($('sync'), async () => {
    stopped = false; syncing = true; $('stop').disabled = false; $('semester').disabled = $('course').disabled = true;
    $('results').replaceChildren(); $('progress').value = 0; $('progress').max = 1;
    let added = 0, same = 0, failed = 0, total = 0, done = 0;
    const list = selectedCourses().filter(c => $('course').value === '*' || String(c.id) === $('course').value);
    function result(text) { const li = document.createElement('li'); li.textContent = text; $('results').append(li); }
    try {
      for (const course of list) {
        if (stopped) break;
        status('讀取教材：' + course.name);
        let materials;
        try { materials = (await api('materials', { course_id: course.id })).materials; }
        catch (error) { failed++; result(course.name + '：' + error.message); continue; }
        total += materials.length; $('progress').max = Math.max(1, total);
        if (!materials.length) result(course.name + '：API 未回傳可匯入教材；尚待與課程頁核對。');
        for (const material of materials) {
          if (stopped) break;
          const label = material.name || material.title || material.id;
          status('下載與比對：' + course.name + '／' + label);
          try {
            const ext = (material.name.split('.').pop() || '').toLowerCase();
            const preview = ['doc', 'ppt'].includes(ext);
            if (!preview && !['pdf', 'docx', 'pptx', 'txt', 'md'].includes(ext)) throw new Error('尚不支援或無法辨識此檔案格式。');
            const blob = await api('download', { reference_id: material.id, preview }, true);
            const bytes = await blob.arrayBuffer();
            if (!bytes.byteLength) throw new Error('檔案內容為空。');
            const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
            if ((preview || ext === 'pdf') && !pdf) throw new Error('平台未提供有效 PDF。');
            if (['docx', 'pptx'].includes(ext) && !pdf && new Uint8Array(bytes)[0] !== 0x50) throw new Error('文件格式驗證失敗。');
            const digest = await hash(bytes), key = 'aivault_tronclass_v1:' + account + ':' + material.id;
            let previous = null;
            try { previous = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
            if (previous?.digest === digest && await lib.getBook(previous.book_id)) { same++; result(label + '：內容相同，略過'); }
            else {
              const filename = pdf ? material.name.replace(/\.[^.]+$/, '') + '.pdf' : material.name;
              const imported = await lib.importFile(new File([bytes], filename, { type: pdf ? 'application/pdf' : blob.type }), {
                title: material.title || filename, author: '東吳大學／' + course.name,
                category: 'TronClass／' + semesterName(course) + '／' + course.name + (material.chapter ? '／' + material.chapter : '')
              });
              if (!imported.pages.length) { await removeLocalVersion(imported.book.id); throw new Error('未能解析出頁面，未計入成功。'); }
              imported.book.tronclass = { account, course_id: course.id, reference_id: material.id, digest };
              await lib.saveBook(imported.book);
              // Replace only after the new version has been parsed and saved successfully.
              localStorage.setItem(key, JSON.stringify({ digest, book_id: imported.book.id, updated_at: new Date().toISOString() }));
              if (previous?.book_id && previous.book_id !== imported.book.id) {
                const old = await lib.getBook(previous.book_id);
                if (old) { old.category = 'TronClass／舊版本'; await lib.saveBook(old); }
              }
              added++; result(label + '：已匯入 ' + imported.pages.length + ' 頁');
            }
          } catch (error) { failed++; result(label + '：' + error.message); }
          done++; $('progress').value = done;
        }
      }
      status((stopped ? '已停止' : '同步結束') + '：匯入 ' + added + '，相同略過 ' + same + '，失敗 ' + failed + '。請返回書架檢查閱讀內容。');
    } finally { syncing = false; $('stop').disabled = true; $('semester').disabled = $('course').disabled = false; }
  });
  window.addEventListener('pagehide', () => { session = ''; account = ''; $('password').value = ''; });
})();
