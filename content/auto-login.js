// Trek 懒猫自动登录注入脚本
// 通过懒猫 OIDC 门禁后，自动向 Trek 注册/登录（httpOnly JWT cookie 由服务端 Set-Cookie 种入），首个注册用户自动成为管理员
(() => {
  const runtime = window.__LZC_INJECT_RUNTIME__ || {};
  if (runtime.executedBefore) {
    return; // 同一页面生命周期内只执行一次
  }

  const SAVED_KEY = "trek_auto_user";

  function getSaved() {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  // 已登录判断：与前端同款，带 cookie 请求 /api/auth/me，200 即已登录（app-config 未登录时也 200 且 permissions 不可靠）
  async function checkAuthed() {
    try {
      const resp = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return resp.ok;
    } catch (e) {
      return false;
    }
  }

  async function autoLogin() {
    if (await checkAuthed()) return;

    const saved = getSaved();
    const username = saved.username || "user" + Math.random().toString(36).slice(2, 8);
    const email = saved.email || username + "@trek.local";
    const password = saved.password || "P" + Math.random().toString(36).slice(2, 10) + "a1!";

    // 1) 尝试登录（长会话）
    let resp = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, remember_me: true }),
    });
    let data = await resp.json().catch(() => ({}));

    // 2) 未注册则注册（首个用户自动成为 admin）
    if (!resp.ok || !data.token) {
      resp = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.token) {
        return; // 静默失败，用户可手动登录或走懒猫账号 SSO
      }
    }

    localStorage.setItem(SAVED_KEY, JSON.stringify({ username, email, password }));
    // 强制回根路径：若当前已是 /login（前端未认证重定向），pathname 以 /login 开头
    // 时 App 的 useEffect 会跳过 loadUser，卡在登录页；根路径才能触发前端认证初始化
    window.location.href = "/";
  }

  autoLogin().catch(() => {
    // 静默失败，不阻塞页面
  });
})();
