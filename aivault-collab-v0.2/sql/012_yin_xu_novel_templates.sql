-- 因序小說角色模板與調度種子（更多性格模板）
-- 套進 agent_registry
-- Apply on TEST project only.

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, abilities, status, connection_status, color
)
VALUES
  ('yin-xu-narrator', '因序旁白', 'Narrator', '說書敘事 / 聲音可選 / 依時間線調整', 'narrate,voice,timeline,adjust', 'WAITING', 'not_connected', '#e94560'),
  ('yin-xu-coordinator', '因序編譯協調', 'Coordinator', '角色分配 / 對話轉問答 / 時間線管理 / 防誘導', 'compile,assign,timeline,anti-railroad,schedule', 'WAITING', 'not_connected', '#3b82f6'),
  ('yin-xu-audio', '因序音效', 'Audio', 'BGM / 特性音樂 / SFX 觸發', 'audio,bgm,sfx,trigger', 'WAITING', 'not_connected', '#22c55e'),
  ('yin-xu-protagonist', '因序主角AI', 'Protagonist', '逾時自動回答 / 不可重來 / 依劇情決定', 'auto-answer,timeout,irreversible,decide', 'WAITING', 'not_connected', '#8b5cf6'),
  ('yin-xu-timeline', '因序時間線', 'Timeline', '已發生事件記錄 / 不可逆 / 角色出場控制', 'timeline,state,irreversible,entry', 'WAITING', 'not_connected', '#06b6d4'),
  ('yin-xu-supervisor', '因序防誘導監督', 'Supervisor', '檢查角色回應是否誘導回原時間線', 'supervise,anti-railroad,check', 'WAITING', 'not_connected', '#ef4444'),
  -- 基礎聲音模板
  ('yin-xu-char-male', '角色模板-男', 'Character', '男性角色扮演 / 知道原結局但不誘導', 'roleplay,male,voice,anti-railroad', 'WAITING', 'not_connected', '#64748b'),
  ('yin-xu-char-female', '角色模板-女', 'Character', '女性角色扮演 / 知道原結局但不誘導', 'roleplay,female,voice,anti-railroad', 'WAITING', 'not_connected', '#ec4899'),
  ('yin-xu-char-old', '角色模板-老', 'Character', '老年角色扮演 / 知道原結局但不誘導', 'roleplay,old,voice,anti-railroad', 'WAITING', 'not_connected', '#f59e0b'),
  ('yin-xu-char-child', '角色模板-幼', 'Character', '幼年角色扮演 / 知道原結局但不誘導', 'roleplay,child,voice,anti-railroad', 'WAITING', 'not_connected', '#84cc16'),
  -- 性格模板
  ('yin-xu-char-passerby', '角色模板-路人', 'Character', '路人角色 / 短暫互動 / 不主導劇情', 'roleplay,passerby,neutral,anti-railroad', 'WAITING', 'not_connected', '#94a3b8'),
  ('yin-xu-char-friend', '角色模板-朋友', 'Character', '友善支持型 / 可提供資訊但不誘導', 'roleplay,friend,supportive,anti-railroad', 'WAITING', 'not_connected', '#22c55e'),
  ('yin-xu-char-villain', '角色模板-反派', 'Character', '對立角色 / 有自己的目標 / 不強制走原結局', 'roleplay,villain,opposition,anti-railroad', 'WAITING', 'not_connected', '#dc2626'),
  ('yin-xu-char-mystery', '角色模板-神秘人', 'Character', '資訊有限 / 說話含糊 / 不揭示結局', 'roleplay,mystery,vague,anti-railroad', 'WAITING', 'not_connected', '#6366f1'),
  ('yin-xu-char-teacher', '角色模板-導師', 'Character', '給予建議但不強迫選擇 / 依性格回應', 'roleplay,teacher,advice,anti-railroad', 'WAITING', 'not_connected', '#0ea5e9'),
  ('yin-xu-char-merchant', '角色模板-商人', 'Character', '交易導向 / 利益優先 / 不誘導主線', 'roleplay,merchant,trade,anti-railroad', 'WAITING', 'not_connected', '#eab308'),
  ('yin-xu-char-guard', '角色模板-守衛', 'Character', '守門或攔截型 / 依規則行動', 'roleplay,guard,rule-based,anti-railroad', 'WAITING', 'not_connected', '#78716c'),
  -- 新增更多性格模板
  ('yin-xu-char-coward', '角色模板-膽小', 'Character', '容易害怕 / 遇事退縮 / 不主動引導', 'roleplay,coward,fearful,anti-railroad', 'WAITING', 'not_connected', '#a78bfa'),
  ('yin-xu-char-brave', '角色模板-勇敢', 'Character', '主動行動 / 有自己判斷 / 不強迫主角', 'roleplay,brave,active,anti-railroad', 'WAITING', 'not_connected', '#f97316'),
  ('yin-xu-char-greedy', '角色模板-貪婪', 'Character', '利益導向 / 可被交易影響 / 不誘導主線', 'roleplay,greedy,selfish,anti-railroad', 'WAITING', 'not_connected', '#facc15'),
  ('yin-xu-char-kind', '角色模板-善良', 'Character', '樂於助人 / 提供幫助但不強迫', 'roleplay,kind,helpful,anti-railroad', 'WAITING', 'not_connected', '#4ade80'),
  ('yin-xu-char-stubborn', '角色模板-固執', 'Character', '堅持己見 / 不易改變 / 依自己邏輯', 'roleplay,stubborn,rigid,anti-railroad', 'WAITING', 'not_connected', '#b45309'),
  ('yin-xu-char-curious', '角色模板-好奇', 'Character', '喜歡打聽 / 主動詢問 / 不揭示結局', 'roleplay,curious,inquisitive,anti-railroad', 'WAITING', 'not_connected', '#2dd4bf'),
  ('yin-xu-char-silent', '角色模板-沈默', 'Character', '話少 / 只在必要時回應', 'roleplay,silent,minimal,anti-railroad', 'WAITING', 'not_connected', '#6b7280'),
  ('yin-xu-char-liar', '角色模板-說謊', 'Character', '可能說謊或隱瞞 / 需讀者自行判斷', 'roleplay,liar,deceptive,anti-railroad', 'WAITING', 'not_connected', '#be123c')
ON CONFLICT (agent_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  capability = EXCLUDED.capability,
  abilities = EXCLUDED.abilities,
  color = EXCLUDED.color,
  updated_at = now();

-- 因序小說主任務種子
INSERT INTO agent_tasks (
  task_id, parent_task_id, title, name, description, owner_id, status, priority,
  current_gate, progress, progress_note, contract_id, created_by
) VALUES (
  'yin-xu-compile',
  NULL,
  '因序小說編譯與調度',
  '因序小說編譯與調度',
  '解析電子書 → 角色分配 → 對話轉問答 → 旁白生成 → 音效規劃 → 上架到因序小說書架。角色知道原結局但不誘導。',
  'owner',
  'READY',
  'HIGH',
  'g1_architecture',
  'WAITING FOR EXECUTION',
  '性格模板已再擴充。',
  'yin-xu.novel.compile.v0.1',
  'owner'
)
ON CONFLICT (task_id) DO NOTHING;

INSERT INTO agent_task_members (task_id, agent_id)
SELECT 'yin-xu-compile', agent_id FROM agent_registry
WHERE agent_id LIKE 'yin-xu-%'
ON CONFLICT (task_id, agent_id) DO NOTHING;

INSERT INTO agent_task_gates (task_id, gate_key, state, note) VALUES
  ('yin-xu-compile', 'g1_architecture', 'WAITING', '性格模板已再擴充'),
  ('yin-xu-compile', 'g2_implementation', 'NOT_STARTED', '等待實際小說解析與編譯'),
  ('yin-xu-compile', 'g3_verification', 'NOT_STARTED', '語音互動與逾時邏輯驗證'),
  ('yin-xu-compile', 'g4_production', 'NOT_STARTED', '上架到因序小說書架')
ON CONFLICT (task_id, gate_key) DO NOTHING;
