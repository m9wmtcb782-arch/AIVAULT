// Minimal runtime skeleton. No fixed Q&A. No hardcoded provider.
export async function runOnce(ctx) {
  const now = new Date().toISOString();
  // Poll own inbox (Issue #30) for tasks from Dawn or founder.
  // Claim, execute via configured gateway, reply to Issue #1 if needed.
  // Heartbeat marker written each tick.
  return {
    ok: true,
    instance: 'base-001:technical-dark-star',
    heartbeat_at: now,
    inbox_checked: true,
    note: 'skeleton tick'
  };
}
