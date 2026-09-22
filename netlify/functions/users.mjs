import crypto from 'node:crypto';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

const BASE_USERS = {
  dcolan: { displayName: 'Darwen Colan', role: 'Superadmin', allowed: ['*'], password: 'dcolan' },
  ctejada: { displayName: 'Cindy Tejada', role: 'Consulta rápida', allowed: ['inicio','miniia','buscador','exclusiones','factores','honorarios','manual','peas','capacitaciones','central','contactos','glosario'], password: 'ctejada' },
  autorizaciones: { displayName: 'Central de Autorizaciones', role: 'Operativo', allowed: ['inicio','miniia','buscador','exclusiones','factores','honorarios','manual','peas','capacitaciones','central','contactos','glosario'], password: 'autorizaciones' },
  farmacia: { displayName: 'Central de Farmacia', role: 'Operativo', allowed: ['inicio','miniia','buscador','exclusiones','factores','honorarios','manual','peas','capacitaciones','central','contactos','glosario'], password: 'farmacia' },
  adt: { displayName: 'ADT', role: 'Operativo', allowed: ['inicio','miniia','buscador','exclusiones','factores','honorarios','manual','peas','capacitaciones','central','contactos','glosario'], password: 'adt' },
  emergencia: { displayName: 'Caja Emergencia', role: 'Operativo', allowed: ['inicio','miniia','buscador','exclusiones','factores','honorarios','manual','peas','capacitaciones','central','contactos','glosario'], password: 'emergencia' },
  ambulatoria: { displayName: 'Caja Ambulatoria', role: 'Operativo', allowed: ['inicio','miniia','buscador','exclusiones','factores','honorarios','manual','peas','capacitaciones','central','contactos','glosario'], password: 'ambulatoria' },
  cav: { displayName: 'Central de Atención Virtual', role: 'Operativo', allowed: ['inicio','miniia','buscador','exclusiones','factores','honorarios','manual','peas','capacitaciones','central','contactos','glosario'], password: 'cav' }
};

function requireConfig() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!PUBLISHABLE_KEY) missing.push('SUPABASE_PUBLISHABLE_KEY');
  if (!SECRET_KEY) missing.push('SUPABASE_SECRET_KEY');
  if (missing.length) throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
}

function normalizeUsername(value = '') {
  return String(value).trim().toLowerCase();
}

function internalEmail(username) {
  const normalized = normalizeUsername(username);
  const safe = normalized.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'user';
  const suffix = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 10);
  return `${safe}.${suffix}@users.iafashub.internal`;
}

async function sbFetch(path, options = {}, useSecret = true) {
  requireConfig();
  const key = useSecret ? SECRET_KEY : PUBLISHABLE_KEY;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || text || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function profileByUsername(username) {
  const u = normalizeUsername(username);
  const rows = await sbFetch(`/rest/v1/hub_users?username=eq.${encodeURIComponent(u)}&select=*`, { method: 'GET' });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function profileByAuthId(authId) {
  const rows = await sbFetch(`/rest/v1/hub_users?auth_user_id=eq.${encodeURIComponent(authId)}&select=*`, { method: 'GET' });
  return Array.isArray(rows) ? rows[0] || null : null;
}

function publicUser(row) {
  return {
    name: row.username,
    displayName: row.display_name || row.username,
    role: row.role || 'Operativo',
    active: row.active !== false,
    allowed: Array.isArray(row.allowed_modules) ? row.allowed_modules : [],
    createdAt: row.created_at || ''
  };
}

async function createAuthUser(username, password) {
  const email = internalEmail(username);
  const payload = await sbFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: { hub_username: normalizeUsername(username) }
    })
  });
  return payload?.user || payload;
}

async function updateAuthUser(authId, attrs) {
  return sbFetch(`/auth/v1/admin/users/${encodeURIComponent(authId)}`, {
    method: 'PUT',
    body: JSON.stringify(attrs)
  });
}

async function deleteAuthUser(authId) {
  return sbFetch(`/auth/v1/admin/users/${encodeURIComponent(authId)}`, { method: 'DELETE' });
}

async function upsertProfile({ authUserId, username, displayName, role, active, allowed }) {
  const body = {
    auth_user_id: authUserId,
    username: normalizeUsername(username),
    display_name: String(displayName || username).trim(),
    role: String(role || 'Operativo').trim(),
    active: active !== false,
    allowed_modules: Array.isArray(allowed) ? allowed : [],
    updated_at: new Date().toISOString()
  };
  const data = await sbFetch('/rest/v1/hub_users?on_conflict=username', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body)
  });
  return Array.isArray(data) ? data[0] : data;
}

async function bootstrapBaseUser(username, password) {
  const base = BASE_USERS[username];
  if (!base || password !== base.password) return null;
  let row = await profileByUsername(username);
  if (row) return row;
  const authUser = await createAuthUser(username, password);
  row = await upsertProfile({
    authUserId: authUser.id,
    username,
    displayName: base.displayName,
    role: base.role,
    active: true,
    allowed: base.allowed
  });
  return row;
}

async function signIn(username, password) {
  const email = internalEmail(username);
  try {
    return await sbFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }, false);
  } catch (err) {
    if (BASE_USERS[username]) {
      await bootstrapBaseUser(username, password);
      return sbFetch('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }, false);
    }
    throw err;
  }
}

async function currentCaller(req) {
  const token = req.headers.get('x-session-token') || '';
  if (!token) throw Object.assign(new Error('Sesión no válida. Vuelve a iniciar sesión.'), { status: 401 });
  const data = await sbFetch('/auth/v1/user', {
    method: 'GET',
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`
    }
  }, false);
  const authId = data?.id;
  if (!authId) throw Object.assign(new Error('No se pudo validar la sesión.'), { status: 401 });
  const profile = await profileByAuthId(authId);
  if (!profile || profile.active === false) throw Object.assign(new Error('Usuario inactivo o sin perfil de acceso.'), { status: 403 });
  return { auth: data, profile };
}

function canManage(profile) {
  const allowed = Array.isArray(profile.allowed_modules) ? profile.allowed_modules : [];
  return profile.role === 'Superadmin' || allowed.includes('*') || allowed.includes('usuarios');
}

async function requireAdmin(req) {
  const caller = await currentCaller(req);
  if (!canManage(caller.profile)) throw Object.assign(new Error('No tienes permisos para administrar usuarios.'), { status: 403 });
  return caller;
}

async function listUsers() {
  const rows = await sbFetch('/rest/v1/hub_users?select=*&order=username.asc', { method: 'GET' });
  const users = {};
  for (const row of rows || []) users[row.username] = publicUser(row);
  return users;
}

async function bodyJson(req) {
  try { return await req.json(); } catch { return {}; }
}

export default async (req) => {
  try {
    requireConfig();
    const url = new URL(req.url);
    const route = url.searchParams.get('route') || 'health';

    if (route === 'health' && req.method === 'GET') {
      return json({ ok: true, service: 'hub-users', version: '4.2.142' });
    }

    if (route === 'login' && req.method === 'POST') {
      const body = await bodyJson(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');
      if (!username || !password) return json({ ok: false, error: 'Ingresa usuario y contraseña.' }, 400);
      let profile = await profileByUsername(username);
      if (profile?.active === false) return json({ ok: false, error: 'Este usuario está inactivo.' }, 403);
      const session = await signIn(username, password);
      profile = await profileByUsername(username);
      if (!profile) return json({ ok: false, error: 'El usuario no tiene un perfil de acceso en el Hub.' }, 403);
      if (profile.active === false) return json({ ok: false, error: 'Este usuario está inactivo.' }, 403);
      return json({ ok: true, token: session.access_token, user: publicUser(profile) });
    }

    if (route === 'users' && req.method === 'GET') {
      await requireAdmin(req);
      return json({ ok: true, users: await listUsers() });
    }

    if (route === 'users' && req.method === 'POST') {
      await requireAdmin(req);
      const body = await bodyJson(req);
      const username = normalizeUsername(body.name);
      const password = String(body.password || '');
      if (!username) return json({ ok: false, error: 'Ingresa un nombre de usuario.' }, 400);
      if (!password) return json({ ok: false, error: 'Ingresa una contraseña para el usuario.' }, 400);
      if (await profileByUsername(username)) return json({ ok: false, error: 'Ese usuario ya existe.' }, 409);
      const authUser = await createAuthUser(username, password);
      try {
        const profile = await upsertProfile({
          authUserId: authUser.id,
          username,
          displayName: body.displayName || username,
          role: body.role || 'Operativo',
          active: body.active !== false,
          allowed: body.allowed || []
        });
        return json({ ok: true, user: publicUser(profile) }, 201);
      } catch (err) {
        try { await deleteAuthUser(authUser.id); } catch {}
        throw err;
      }
    }

    if (route.startsWith('users/') && req.method === 'PUT') {
      await requireAdmin(req);
      const username = normalizeUsername(decodeURIComponent(route.slice('users/'.length)));
      const row = await profileByUsername(username);
      if (!row) return json({ ok: false, error: 'Usuario no encontrado.' }, 404);
      const body = await bodyJson(req);
      if (body.password) await updateAuthUser(row.auth_user_id, { password: String(body.password) });
      const updated = await upsertProfile({
        authUserId: row.auth_user_id,
        username,
        displayName: body.displayName ?? row.display_name,
        role: body.role ?? row.role,
        active: body.active ?? row.active,
        allowed: body.allowed ?? row.allowed_modules
      });
      return json({ ok: true, user: publicUser(updated) });
    }

    if (route.startsWith('users/') && route.endsWith('/toggle') && req.method === 'POST') {
      const caller = await requireAdmin(req);
      const username = normalizeUsername(decodeURIComponent(route.slice('users/'.length, -'/toggle'.length)));
      const row = await profileByUsername(username);
      if (!row) return json({ ok: false, error: 'Usuario no encontrado.' }, 404);
      if (row.auth_user_id === caller.auth.id && row.active !== false) return json({ ok: false, error: 'No puedes desactivar tu propio usuario.' }, 400);
      const updated = await upsertProfile({
        authUserId: row.auth_user_id,
        username,
        displayName: row.display_name,
        role: row.role,
        active: row.active === false,
        allowed: row.allowed_modules
      });
      return json({ ok: true, user: publicUser(updated) });
    }

    if (route.startsWith('users/') && req.method === 'DELETE') {
      const caller = await requireAdmin(req);
      const username = normalizeUsername(decodeURIComponent(route.slice('users/'.length)));
      const row = await profileByUsername(username);
      if (!row) return json({ ok: false, error: 'Usuario no encontrado.' }, 404);
      if (row.auth_user_id === caller.auth.id) return json({ ok: false, error: 'No puedes eliminar el usuario con el que estás conectado.' }, 400);
      await deleteAuthUser(row.auth_user_id);
      await sbFetch(`/rest/v1/hub_users?username=eq.${encodeURIComponent(username)}`, { method: 'DELETE' });
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Ruta no disponible.' }, 404);
  } catch (err) {
    const status = Number(err?.status) || 500;
    const message = status === 401 ? 'Usuario o contraseña incorrectos.' : (err?.message || String(err));
    return json({ ok: false, error: message }, status);
  }
};
