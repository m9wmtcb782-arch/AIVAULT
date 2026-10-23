// Dark Star wake runtime. No fixed Q&A. No hardcoded provider.
// Polls Issue #30, claims new tasks, replies with evidence.

export async function runOnce(ctx) {
  const now = new Date().toISOString();
  const result = {
    ok: true,
    instance: 'base-001:technical-dark-star',
    heartbeat_at: now,
    inbox_checked: false,
    claimed: [],
    replied: [],
    errors: []
  };

  if (!ctx?.github?.token || !ctx?.github?.owner || !ctx?.github?.repo) {
    result.ok = false;
    result.errors.push('MISSING_GITHUB_CTX');
    return result;
  }

  try {
    const issue = 30;
    const comments = await listComments(ctx, issue);
    result.inbox_checked = true;

    const pending = comments.filter(c =>
      !c.body?.includes('<!-- DAWN-GROK-AUTOMATION -->') &&
      !c.body?.includes('<!-- DARK-STAR-PROCESSED -->') &&
      c.user?.login !== ctx.github.actor
    );

    for (const c of pending.slice(0, 3)) {
      result.claimed.push(c.id);
      const reply = await replyTo(ctx, issue, `<!-- DARK-STAR-PROCESSED -->\n\n已讀取 #${c.id}。\n待辦：${summarize(c.body)}\n時間：${now}`);
      result.replied.push(reply.id);
    }
  } catch (e) {
    result.ok = false;
    result.errors.push(String(e.message || e));
  }

  return result;
}

async function listComments(ctx, issue) {
  const url = `https://api.github.com/repos/${ctx.github.owner}/${ctx.github.repo}/issues/${issue}/comments?per_page=30`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ctx.github.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'dark-star-runtime'
    }
  });
  if (!res.ok) throw new Error(`LIST_${res.status}`);
  return res.json();
}

async function replyTo(ctx, issue, body) {
  const url = `https://api.github.com/repos/${ctx.github.owner}/${ctx.github.repo}/issues/${issue}/comments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.github.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'dark-star-runtime'
    },
    body: JSON.stringify({ body })
  });
  if (!res.ok) throw new Error(`REPLY_${res.status}`);
  return res.json();
}

function summarize(body) {
  if (!body) return '空';
  const line = body.split('\n').find(l => l.trim() && !l.startsWith('<!--')) || '';
  return line.slice(0, 120);
}
