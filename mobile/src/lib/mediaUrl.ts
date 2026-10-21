/** Signed links can expire while the app is asleep, even inside our display cache. */
export function mediaUrlIsFresh(uri: string, now = Date.now()) {
  try {
    const token = new URL(uri).searchParams.get('token');
    if (!token) return true;
    const payload = token.split('.')[1];
    if (!payload) return false;
    const expiry = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).exp;
    return typeof expiry === 'number' && expiry * 1000 > now + 60000;
  } catch { return false; }
}
