-- 因序小說角色模板與調度種子
-- 套進 agent_registry，核心角色 + 模板，不常駐1000個
-- Apply on TEST project only.

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, abilities, status, connection_status, color
)
VALUES
  ('yin-xu-narrator', '因序旁白', 'Narrator', '說書敘事 / 聲音可選 / 依時間線調整', 'narrate,voice,timeline,adjust', 'WAITING', 'not_connected', '#e94560'),
  ('yin-xu-coordinator', '因序編譯協調', 'Coordinator', '角色分配 / 對話轉問答 / 時間線管理 / 防誘導', 'compile,assign,timeline,anti-railroad,schedule', 'WAITING', 'not_connected', '#3b82f6'),
  ('yin-xu-audio', '因序音效', 'Audio', 'BGM / 特性音樂 / SFX 觸發', 'audio,bgm,sfx,trigger', 'WAITING', 'not_connected', '#22c55e'),
  ('yin-xu-protagonist', '因序主角AI', 'Protagonist', '逾時自動回答 / 不可重來 / 依劇情決定', 'auto-answer,timeout,irreversible,decide', 'WAITING', 'not_connected', '#8b5cf6'),
  ('yin-xu-char-male', '角色模板-男', 'Character', '男性角色扮演 / 知道原結局但不誘導', 'roleplay,male,voice,anti-railroad', 'WAITING', 'not_connected', '#64748b'),
  ('yin-xu-char-female', '角色模板-女', 'Character', '女性角色扮演 / 知道原結局但不誘導', 'roleplay,female,voice,anti-railroad', 'WAITING', 'not_connected', '#ec4899'),
  ('yin-xu-char-old', '角色模板-老', 'Character', '老年角色扮演 / 知道原結局但不誘導', 'roleplay,old,voice,anti-railroad', 'WAITING', 'not_connected', '#f59e0b'),
  ('yin-xu-char-child', '角色模板-幼', 'Character', '幼年角色扮演 / 知道原結局但不誘導', 'roleplay,child,voice,anti-railroad', 'WAITING', 'not_connected', '#84cc16'),
  ('yin-xu-timeline', '因序時間線', 'Timeline', '已發生事件記錄 / 不可逆 / 角色出場控制', 'timeline,state,irreversible,entry', 'WAITING', 'not_connected', '#06b6d4'),
  ('yin-xu-supervisor', '因序防誘導監督', 'Supervisor', '檢查角色回應是否誘導回原時間線', 'supervise,anti-railroad,check', 'WAITING', 'not_connected', '#ef4444')
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
  '模板已種入。等待實際編譯任務。',
  'yin-xu.novel.compile.v0.1',
  'owner'
)
ON CONFLICT (task_id) DO NOTHING;

INSERT INTO agent_task_members (task_id, agent_id) VALUES
  ('yin-xu-compile', 'yin-xu-narrator'),
  ('yin-xu-compile', 'yin-xu-coordinator'),
  ('yin-xu-compile', 'yin-xu-audio'),
  ('yin-xu-compile', 'yin-xu-protagonist'),
  ('yin-xu-compile', 'yin-xu-timeline'),
  ('yin-xu-compile', 'yin-xu-supervisor')
ON CONFLICT (task_id, agent_id) DO NOTHING;

INSERT INTO agent_task_gates (task_id, gate_key, state, note) VALUES
  ('yin-xu-compile', 'g1_architecture', 'WAITING', '角色模板與調度規格已寫入'),
  ('yin-xu-compile', 'g2_implementation', 'NOT_STARTED', '等待實際小說解析與編譯'),
  ('yin-xu-compile', 'g3_verification', 'NOT_STARTED', '語音互動與逾時邏輯驗證'),
  ('yin-xu-compile', 'g4_production', 'NOT_STARTED', '上架到因序小說書架')
ON CONFLICT (task_id, gate_key) DO NOTHING;
