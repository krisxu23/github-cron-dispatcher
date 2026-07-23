export default {
  async fetch(request, env, ctx) {
    const result = await triggerDispatches(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  },

  async scheduled(event, env, ctx) {
    await triggerDispatches(env);
  },
};

async function triggerDispatches(env) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) return [{ error: "未配置 GITHUB_TOKEN 环境变量" }];

  const targets = parseTargets(env.TARGETS);
  if (targets.length === 0) return [{ error: "TARGETS 环境变量未配置或格式错误" }];

  const results = [];

  for (const target of targets) {
    const parts = target.split("/").map(s => s.trim());
    let owner, repo, event_type;
    if (parts.length === 3) {
      [owner, repo, event_type] = parts;
    } else if (parts.length === 2) {
      [owner, repo] = parts;
      event_type = "cloudflare_cron_trigger";
    } else {
      results.push({ target, error: "格式错误，应为 owner/repo 或 owner/repo/event_type" });
      continue;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Cloudflare-Worker-Cron'
        },
        body: JSON.stringify({
          event_type,
          client_payload: {
            triggered_by: 'Cloudflare Workers Cron',
            cron_time: new Date().toISOString()
          }
        })
      });
      results.push({
        target: `${owner}/${repo}`,
        event_type,
        status: response.status,
        ok: response.ok,
        error: response.ok ? null : await response.text()
      });
    } catch (error) {
      results.push({ target: `${owner}/${repo}`, event_type, error: error.message });
    }
  }
  return results;
}

function parseTargets(raw) {
  if (!raw) return [];
  return raw.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
}
