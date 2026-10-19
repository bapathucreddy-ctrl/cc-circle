import { serveRequest } from '../_shared/http.ts';
import { authenticate, body, HttpError, json, uuid } from '../_shared/payments.ts';
import { validUploadHeader } from '../_shared/upload.ts';
import { callbackUrl, digest, secret, type Provider } from '../_shared/portfolio.ts';
import { IMAGE_LIMIT, reviewPortfolioImage } from '../_shared/portfolioImageReview.ts';
const bucket = 'portfolio-work';
serveRequest(async req => {
  if (req.method === 'OPTIONS') return json({});
  try {
    const { admin, user } = await authenticate(req); const input = await body(req);
    const { data: permitted, error: limitError } = await admin.rpc('claim_portfolio_operation', { p_user_id: user.id });
    if (limitError) throw new HttpError(503, 'Portfolio service is temporarily unavailable.');
    if (!permitted) throw new HttpError(429, 'Too many portfolio requests. Please wait a minute.');
    const action = input.action;
    if (action === 'connect') {
      const provider = input.provider as Provider;
      if (provider !== 'instagram') throw new HttpError(400, 'Connect Instagram to verify account ownership. Upload your work separately.');
      secret('PORTFOLIO_TOKEN_KEY');
      const client = secret(provider === 'instagram' ? 'INSTAGRAM_CLIENT_ID' : 'YOUTUBE_CLIENT_ID');
      secret(provider === 'instagram' ? 'INSTAGRAM_CLIENT_SECRET' : 'YOUTUBE_CLIENT_SECRET');
      const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2,'0')).join('');
      // Prevent unbounded connection attempts by one account.
      const { count } = await admin.from('portfolio_imports').select('id', { count: 'exact', head: true }).eq('professional_id', user.id).gt('created_at', new Date(Date.now()-60000).toISOString());
      if ((count || 0) >= 5) throw new HttpError(429, 'Wait a minute before connecting again.');
      const { data: job, error } = await admin.from('portfolio_imports').insert({ professional_id: user.id, provider, state_hash: await digest(state), expires_at: new Date(Date.now()+600000).toISOString() }).select('id').single();
      if (error) throw new HttpError(500, 'Unable to start account connection.');
      const url = new URL(provider === 'instagram' ? 'https://www.instagram.com/oauth/authorize' : 'https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: client, redirect_uri: callbackUrl(), response_type: 'code', state,
        scope: provider === 'instagram' ? 'instagram_business_basic' : 'https://www.googleapis.com/auth/youtube.readonly',
        ...(provider === 'youtube' ? { prompt: 'consent', access_type: 'online' } : { enable_fb_login: '0' }) }).toString();
      return json({ url: url.toString(), import_id: job.id });
    }
    if (action === 'verification' || action === 'avatar' || action === 'presentation') {
      const owner = uuid(input.professional_id);
      const { data: profile, error: profileError } = await admin.from('professionals').select('is_published').eq('id', owner).maybeSingle();
      if (profileError) throw new HttpError(503, 'Unable to check Instagram connection.');
      if (owner !== user.id && !profile?.is_published) throw new HttpError(404, 'Professional not found.');
      let src: string | null = null;
      if (action === 'avatar' || action === 'presentation') {
        const { data: photo, error } = await admin.from('professional_photos').select('storage_path').eq('professional_id', owner).maybeSingle();
        if (error) throw new HttpError(503, 'Unable to load profile photo.');
        if (photo) {
          const { data, error: urlError } = await admin.storage.from(bucket).createSignedUrl(photo.storage_path, 3600);
          if (urlError) throw new HttpError(503, 'Unable to load profile photo.');
          src = data?.signedUrl || null;
        }
        if (action === 'avatar') return json({ src });
      }
      const { data, error } = await admin.from('portfolio_connections').select('expires_at').eq('professional_id', owner).eq('provider', 'instagram').maybeSingle();
      if (error) throw new HttpError(503, 'Unable to check Instagram connection.');
      return json({ verified: Boolean(data && new Date(data.expires_at).getTime() > Date.now()), ...(action === 'presentation' ? { src } : {}) });
    }
    if (action === 'sync') throw new HttpError(400, 'Instagram verifies your account. Upload work samples separately.');
    if (action === 'disconnect') {
      const provider = input.provider as Provider;
      if (!['instagram', 'youtube'].includes(provider)) throw new HttpError(400, 'Invalid provider.');
      const { error } = await admin.from('portfolio_connections').delete().eq('professional_id', user.id).eq('provider', provider);
      if (error) throw new HttpError(500, 'Unable to disconnect account.');
      return json({ disconnected: true });
    }
    if (action === 'upload_url') {
      const mime = String(input.mime || '');
      const extensions: Record<string,string> = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' };
      if (!extensions[mime]) throw new HttpError(400, 'Upload a JPG, PNG or WebP photo.');
      const { data: existing } = await admin.storage.getBucket(bucket);
      if (!existing) {
        const { error } = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: IMAGE_LIMIT - 1, allowedMimeTypes: Object.keys(extensions) });
        if (error && !error.message.toLowerCase().includes('already exists')) throw new HttpError(500, 'Unable to prepare portfolio uploads.');
      }
      const path = `${user.id}/${crypto.randomUUID()}.${extensions[mime]}`;
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
      if (error || !data) throw new HttpError(500, 'Unable to prepare this upload.');
      return json({ path, token: data.token });
    }
    if (action === 'add_upload' || action === 'set_avatar') {
      const path = String(input.path || '');
      if (!path.startsWith(`${user.id}/`) || !/^[a-f0-9-]+\/(?:[a-f0-9-]+)\.(jpg|png|webp)$/.test(path)) throw new HttpError(400, 'Invalid work upload.');
      const approvedPath = `${user.id}/approved-${path.split('/')[1]}`;
      const { data: saved, error: savedError } = await admin.from(action === 'set_avatar' ? 'professional_photos' : 'portfolio_media')
        .select(action === 'set_avatar' ? 'professional_id' : 'id').eq('professional_id', user.id).eq('storage_path', approvedPath).maybeSingle();
      if (savedError) throw new HttpError(503, 'Unable to check this photo. Please try again.');
      if (saved) return json({ added: true });
      const { data: files, error } = await admin.storage.from(bucket).list(user.id, { search: path.split('/')[1] });
      const file = files?.find(file => `${user.id}/${file.name}` === path);
      if (error || !file || Number(file.metadata?.size)>=IMAGE_LIMIT) throw new HttpError(400, 'Upload a photo smaller than 5 MB first.');
      const kind = 'image';
      const { data: uploaded, error: downloadError } = await admin.storage.from(bucket).download(path);
      const extension = path.split('.').pop()!;
      if (downloadError || !uploaded || uploaded.size >= IMAGE_LIMIT || !validUploadHeader(new Uint8Array(await uploaded.slice(0,64).arrayBuffer()), extension)) {
        await admin.storage.from(bucket).remove([path]);
        throw new HttpError(400, 'This file does not match a supported photo.');
      }
      const bytes = new Uint8Array(await uploaded.arrayBuffer());
      try { await reviewPortfolioImage(bytes); } catch (error) {
        if (error instanceof HttpError && error.status === 422) await admin.storage.from(bucket).remove([path]);
        throw error;
      }
      // Publish an immutable server-written copy of exactly the reviewed bytes.
      const mime = extension === 'jpg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : 'image/webp';
      const { error: copyError } = await admin.storage.from(bucket).upload(approvedPath, bytes, { contentType: mime, upsert: false });
      if (copyError) throw new HttpError(500, 'Unable to save this photo. Please try again.');
      if (action === 'set_avatar') {
        const { data: previous } = await admin.from('professional_photos').select('storage_path').eq('professional_id', user.id).maybeSingle();
        const { error } = await admin.from('professional_photos').upsert({ professional_id: user.id, storage_path: approvedPath, updated_at: new Date().toISOString() });
        await admin.storage.from(bucket).remove([path]);
        if (error) { await admin.storage.from(bucket).remove([approvedPath]); throw new HttpError(500, 'Unable to save profile photo.'); }
        if (previous?.storage_path && previous.storage_path !== approvedPath) await admin.storage.from(bucket).remove([previous.storage_path]);
        return json({ added: true });
      }
      const { error: insertError } = await admin.rpc('append_portfolio_upload', { p_professional_id: user.id, p_path: approvedPath, p_kind: kind });
      await admin.storage.from(bucket).remove([path]);
      if (insertError) {
        await admin.storage.from(bucket).remove([approvedPath]);
        throw new HttpError(409, 'Your portfolio is full. Remove an item before adding another.');
      }
      return json({ added: true });
    }
    if (action === 'delete') {
      const id = uuid(input.id);
      const { data, error } = await admin.from('portfolio_media').delete().eq('id', id).eq('professional_id', user.id).select('storage_path').maybeSingle();
      if (error || !data) throw new HttpError(404, 'Work sample not found.');
      if (data.storage_path?.startsWith(`${user.id}/`)) await admin.storage.from(bucket).remove([data.storage_path]);
      return json({ deleted: true });
    }
    if (action === 'list') {
      const owner = uuid(input.professional_id);
      if (owner !== user.id) {
        const { data: profile } = await admin.from('professionals').select('id').eq('id', owner).eq('is_published', true).maybeSingle();
        if (!profile) throw new HttpError(404, 'Professional not found.');
      }
      let { data: rows, error } = await admin.from('portfolio_media').select('*').eq('professional_id', owner).order('position').order('updated_at', { ascending: false }).limit(10);
      if (error) throw new HttpError(500, 'Unable to load work samples.');
      const media = await Promise.all((rows || []).filter(row => owner === user.id || (row.provider === 'upload' && row.kind === 'image' && row.storage_path?.startsWith(owner + '/approved-'))).map(async row => {
        let src = row.media_url;
        if (row.storage_path) { const { data } = await admin.storage.from(bucket).createSignedUrl(row.storage_path, 3600); src = data?.signedUrl || null; }
        return { id: row.id, provider: row.provider, kind: row.kind, src, preview: row.preview_url, youtubeId: row.youtube_id, needsReview: !(row.provider === 'upload' && row.kind === 'image' && row.storage_path?.startsWith(owner + '/approved-')) };
      }));
      let connections: { provider: string; reconnect: boolean }[] = [];
      if (owner === user.id) {
        const { data } = await admin.from('portfolio_connections').select('provider,expires_at').eq('professional_id', owner);
        connections = (data || []).map(row => ({ provider: row.provider, reconnect: new Date(row.expires_at).getTime()<Date.now() }));
      }
      return json({ media, connections });
    }
    throw new HttpError(400, 'Unknown portfolio operation.');
  } catch (error) { return error instanceof HttpError ? json({ error: error.message }, error.status) : json({ error: 'Unable to update this portfolio. Please try again.' }, 500); }
});
