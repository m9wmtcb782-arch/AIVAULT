(() => {
  'use strict';
  const PROJECT_URL = 'https://clcddygkaaqqtsbswgdf.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_1D05YGthBrNGg-5L92TLCw_GiLnInBu';
  const $ = (id) => document.getElementById(id);
  const status = (message, isError = false) => {
    const el = $('taxDbStatus');
    if (!el) return;
    el.textContent = message;
    el.dataset.state = isError ? 'error' : 'ok';
  };
  let client = null;
  let currentUser = null;
  function setControls(enabled) {
    ['taxDbSave', 'taxDbRefresh'].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !enabled;
    });
  }
  function collectSnapshot() {
    const textOf = (id) => {
      const el = $(id);
      return el && el.classList.contains('show') ? el.innerText.trim() : '';
    };
    const form = $('legalQuestion');
    return {
      schema_version: 1,
      captured_at: new Date().toISOString(),
      scenario_result: textOf('simResult'),
      rights_wizard_summary: textOf('wizardPanel'),
      legal_analysis: textOf('analysisResult'),
      selected_case: textOf('caseResult'),
      inputs: { legal_question: form ? form.value.trim() : '' }
    };
  }
  function renderRecords(rows) {
    const list = $('taxDbRecords');
    if (!list) return;
    list.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'small';
      empty.textContent = '目前沒有已儲存的模擬紀錄。';
      list.appendChild(empty);
      return;
    }
    rows.forEach((record) => {
      const item = document.createElement('div');
      item.className = 'tax-db-record';
      const info = document.createElement('span');
      info.textContent = record.title + '｜' + new Date(record.created_at).toLocaleString('zh-TW');
      const view = document.createElement('button');
      view.type = 'button'; view.className = 'secondary'; view.textContent = '查看';
      view.addEventListener('click', () => showRecord(record));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'secondary'; remove.textContent = '刪除';
      remove.addEventListener('click', () => deleteRecord(record.id));
      item.append(info, view, remove);
      list.appendChild(item);
    });
  }
  function showRecord(record) {
    const panel = $('taxDbRecordView');
    if (!panel) return;
    const p = record.payload || {};
    panel.textContent = [
      record.title,
      '儲存時間：' + new Date(record.created_at).toLocaleString('zh-TW'), '',
      '情境模擬：', p.scenario_result || '未保存', '',
      '權利主張精靈：', p.rights_wizard_summary || '未保存', '',
      '法律爭點分析：', p.legal_analysis || '未保存', '',
      '案例內容：', p.selected_case || '未保存', '',
      '輸入問題：', p.inputs && p.inputs.legal_question || '未填寫'
    ].join('\n');
    panel.hidden = false;
  }
  async function refreshRecords() {
    if (!client || !currentUser) {
      status('請先登入 AIVAULT，才能讀取個人紀錄。', true);
      return;
    }
    status('正在讀取你的模擬紀錄…');
    const { data, error } = await client.from('ai_tax_simulation_records')
      .select('id,title,created_at,payload').order('created_at', { ascending: false }).limit(30);
    if (error) {
      status('讀取失敗：' + error.message + '（請確認資料庫 migration 已套用及 Data API 權限）', true);
      return;
    }
    renderRecords(data || []);
    status('已連線資料庫；顯示最近 ' + (data || []).length + ' 筆個人紀錄。');
  }
  async function saveSnapshot() {
    if (!client || !currentUser) {
      status('尚未登入 AIVAULT。登入後才能把紀錄儲存到資料庫。', true);
      return;
    }
    const payload = collectSnapshot();
    const hasContent = payload.scenario_result || payload.rights_wizard_summary ||
      payload.legal_analysis || payload.selected_case || payload.inputs.legal_question;
    if (!hasContent) {
      status('目前沒有可儲存的模擬結果。請先執行一項模擬。', true);
      return;
    }
    const title = ($('taxDbTitle') && $('taxDbTitle').value.trim()) || '稅務模擬紀錄';
    setControls(false);
    status('正在安全儲存到個人資料庫…');
    const { error } = await client.from('ai_tax_simulation_records').insert({ title, payload });
    setControls(true);
    if (error) { status('儲存失敗：' + error.message, true); return; }
    status('儲存成功。這筆紀錄已綁定你的登入帳號。');
    await refreshRecords();
  }
  async function deleteRecord(id) {
    if (!client || !currentUser || !id) return;
    if (!window.confirm('確定刪除這筆模擬紀錄？此操作無法復原。')) return;
    const { error } = await client.from('ai_tax_simulation_records').delete().eq('id', id);
    if (error) { status('刪除失敗：' + error.message, true); return; }
    const panel = $('taxDbRecordView');
    if (panel) { panel.hidden = true; panel.textContent = ''; }
    status('紀錄已刪除。');
    await refreshRecords();
  }
  async function init() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      status('Supabase SDK 載入失敗，資料庫功能暫不可用。', true); return;
    }
    client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      currentUser = null; setControls(false);
      status('尚未登入 AIVAULT。一般模擬仍可使用；登入後才能保存及讀取個人紀錄。', true);
      return;
    }
    currentUser = data.user; setControls(true);
    status('已確認登入身分，正在連接個人資料庫…');
    await refreshRecords();
    client.auth.onAuthStateChange((_event, session) => {
      currentUser = session && session.user ? session.user : null;
      setControls(!!currentUser);
      if (currentUser) refreshRecords();
      else status('登入狀態已結束；個人紀錄暫不可讀取。', true);
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('taxDbSave')?.addEventListener('click', saveSnapshot);
    $('taxDbRefresh')?.addEventListener('click', refreshRecords);
    init().catch((error) => status('資料庫初始化失敗：' + error.message, true));
  });
})();
