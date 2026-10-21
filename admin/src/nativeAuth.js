export function adminAuthStorage(session, local) {
  const target = key => key.endsWith('-code-verifier') ? local : session;
  return {getItem:key=>target(key).getItem(key),setItem:(key,value)=>target(key).setItem(key,value),removeItem:key=>target(key).removeItem(key)};
}
export function nativeAuthCode(value) {
  const url=new URL(value);
  if(url.protocol!=='cccircle-admin:'||url.hostname!=='auth'||url.pathname!=='/callback'||url.username||url.password||url.port)throw Error('Invalid sign-in callback.');
  const error=url.searchParams.get('error_description');if(error)throw Error(error);
  const code=url.searchParams.get('code');if(!code)throw Error('This sign-in link has no authorization code. Please sign in again.');
  return code;
}
