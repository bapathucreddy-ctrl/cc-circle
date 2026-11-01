export function adminAuthStorage(session, local, persistent = local) {
  return {
    getItem(key) {
      const saved=persistent.getItem(key);if(saved!==null)return saved;
      const previous=session.getItem(key)??local.getItem(key);
      if(previous!==null){persistent.setItem(key,previous);session.removeItem(key);if(persistent!==local)local.removeItem(key);}
      return previous;
    },
    setItem(key,value){persistent.setItem(key,value);session.removeItem(key);if(persistent!==local)local.removeItem(key);},
    removeItem(key){persistent.removeItem(key);session.removeItem(key);local.removeItem(key);},
  };
}
export function nativeAuthCode(value) {
  const url=new URL(value);
  if(url.protocol!=='cccircle-admin:'||url.hostname!=='auth'||url.pathname!=='/callback'||url.username||url.password||url.port)throw Error('Invalid sign-in callback.');
  const error=url.searchParams.get('error_description');if(error)throw Error(error);
  const code=url.searchParams.get('code');if(!code)throw Error('This sign-in link has no authorization code. Please sign in again.');
  return code;
}
