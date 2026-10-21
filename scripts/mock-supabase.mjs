import http from 'http';
import { URL } from 'url';

// In-memory database initialized with supabase/seed.sql data
export function createInitialState() {
  return {
    profiles: [
      { id: '11111111-1111-1111-1111-111111111111', display_name: 'Rohan Mehta', upi_id: 'rohan@okaxis' },
      { id: '22222222-2222-2222-2222-222222222222', display_name: 'Meera Iyer', upi_id: 'meera@oksbi' },
      { id: '33333333-3333-3333-3333-333333333333', display_name: 'Karan Verma', upi_id: 'karan@okhdfcbank' },
      { id: '44444444-4444-4444-4444-444444444444', display_name: 'Priya Sharma', upi_id: null },
    ],
    trips: [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Goa Trip',
        destination: 'Goa',
        start_date: '2026-12-10',
        end_date: '2026-12-15',
        currency: 'INR',
        budget_paise: 5000000,
        created_by: '11111111-1111-1111-1111-111111111111',
        archived_at: null,
      },
    ],
    trip_families: [],
    trip_members: [
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', user_id: '11111111-1111-1111-1111-111111111111', display_name: 'Rohan Mehta', role: 'admin', left_at: null, family_id: null, email: null, phone: null },
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', user_id: '22222222-2222-2222-2222-222222222222', display_name: 'Meera Iyer', role: 'member', left_at: null, family_id: null, email: null, phone: null },
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', user_id: '33333333-3333-3333-3333-333333333333', display_name: 'Karan Verma', role: 'member', left_at: null, family_id: null, email: null, phone: null },
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', user_id: '44444444-4444-4444-4444-444444444444', display_name: 'Priya Sharma', role: 'member', left_at: null, family_id: null, email: null, phone: null },
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', user_id: null, display_name: 'Kabir', role: 'member', left_at: null, family_id: null, email: null, phone: null },
    ],
    category_limits: [
      { trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', category: 'stay', limit_paise: 2500000 },
      { trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', category: 'food', limit_paise: 1500000 },
      { trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', category: 'transport', limit_paise: 1000000 },
    ],
    recurring_rules: [],
    due_reminders: [],
    invites: [
      {
        token: 'goa2026secretinvitekey128',
        trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        created_by: '11111111-1111-1111-1111-111111111111',
        expires_at: '2026-12-31T23:59:59Z',
        revoked_at: null,
      },
    ],
    expenses: [
      {
        id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: 'Villa Booking Advance',
        amount_paise: 2000000,
        category: 'stay',
        paid_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        spent_on: '2026-12-10',
        note: 'Booking for Anjuna villa',
        split_type: 'equal',
        split_input: { member_ids: ['baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5'] },
        created_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        version: 1,
        deleted_at: null,
      },
      {
        id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: 'Airport Cab',
        amount_paise: 180000,
        category: 'transport',
        paid_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        spent_on: '2026-12-10',
        note: 'Goa airport to Anjuna',
        split_type: 'equal',
        split_input: { member_ids: ['baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'] },
        created_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        version: 1,
        deleted_at: null,
      },
    ],
    expense_splits: [
      { expense_id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', share_paise: 400000 },
      { expense_id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', share_paise: 400000 },
      { expense_id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', share_paise: 400000 },
      { expense_id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', share_paise: 400000 },
      { expense_id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', share_paise: 400000 },
      { expense_id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', share_paise: 60000 },
      { expense_id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', share_paise: 60000 },
      { expense_id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', share_paise: 60000 },
    ],
    settlements: [
      {
        id: 'daaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        trip_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        from_member: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        to_member: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        amount_paise: 60000,
        paid_on: '2026-12-11',
        note: 'Cab share UPI',
        created_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        voided_at: null,
      },
    ],
  };
}

let db = createInitialState();

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function getUserFromAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload.sub) {
        return { id: payload.sub, email: payload.email || 'user@example.com' };
      }
    }
  } catch {}
  return { id: '11111111-1111-1111-1111-111111111111', email: 'rohan@example.com' };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Auth endpoints
  if (pathname === '/auth/v1/user') {
    const user = getUserFromAuth(req);
    if (!user) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Not authenticated' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(user));
    return;
  }

  if (pathname === '/auth/v1/otp') {
    res.writeHead(200);
    res.end(JSON.stringify({}));
    return;
  }

  if (pathname === '/auth/v1/token') {
    const body = await parseBody(req);
    if (body.password === 'wrong-password') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }));
      return;
    }
    const user = {
      id: '11111111-1111-1111-1111-111111111111',
      email: body.email || 'rohan@example.com',
      user_metadata: { full_name: 'Rohan Mehta' },
    };
    res.writeHead(200);
    res.end(JSON.stringify({
      access_token: 'mock-token-rohan',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user,
    }));
    return;
  }

  if (pathname === '/auth/v1/signup') {
    const body = await parseBody(req);
    if (body.email === 'alreadyexists@example.com') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'user_already_exists', msg: 'User already registered' }));
      return;
    }
    const userId = `user-${Date.now()}`;
    const isAnon = !body.email;
    const user = {
      id: userId,
      email: body.email || null,
      is_anonymous: isAnon,
      user_metadata: body.data || { full_name: isAnon ? 'Guest Traveler' : 'New User' },
    };
    db.profiles.push({
      id: userId,
      display_name: (body.data && body.data.full_name) || (body.email ? body.email.split('@')[0] : 'Guest Traveler'),
      upi_id: null,
    });
    res.writeHead(200);
    res.end(JSON.stringify({
      access_token: `mock-token-${userId}`,
      token_type: 'bearer',
      expires_in: 3600 * 24 * 30,
      refresh_token: 'mock-refresh-token',
      user,
      session: {
        access_token: `mock-token-${userId}`,
        token_type: 'bearer',
        expires_in: 3600 * 24 * 30,
        refresh_token: 'mock-refresh-token',
        user,
      },
    }));
    return;
  }

  if (pathname === '/auth/v1/logout') {
    res.writeHead(200);
    res.end(JSON.stringify({}));
    return;
  }

  // REST RPC endpoints
  if (pathname === '/rest/v1/rpc/create_trip') {
    const body = await parseBody(req);
    const user = getUserFromAuth(req) || { id: '11111111-1111-1111-1111-111111111111' };
    const tripId = `trip-${Date.now()}`;
    const newTrip = {
      id: tripId,
      name: body.trip_name || 'New Trip',
      destination: body.destination || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      budget_paise: body.budget_paise || null,
      currency: 'INR',
      created_by: user.id,
      archived_at: null,
    };
    db.trips.push(newTrip);
    db.trip_members.push({
      id: `m-${Date.now()}`,
      trip_id: tripId,
      user_id: user.id,
      display_name: body.creator_name || 'Rohan Mehta',
      role: 'admin',
      left_at: null,
    });
    res.writeHead(200);
    res.end(JSON.stringify(tripId));
    return;
  }

  if (pathname === '/rest/v1/rpc/join_trip') {
    const body = await parseBody(req);
    const user = getUserFromAuth(req) || { id: `anon-${Date.now()}` };
    const token = body.p_token || body.invite_token;
    const invite = db.invites.find((i) => i.token === token);
    if (!invite || invite.revoked_at || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: 'Invalid or expired invite token' }));
      return;
    }
    const claimId = body.p_claim_member_id || body.claim_member_id;
    if (claimId) {
      const ph = db.trip_members.find((m) => m.id === claimId);
      if (ph) {
        ph.user_id = user.id;
        if (body.p_display_name) ph.display_name = body.p_display_name;
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, trip_id: invite.trip_id, member_id: ph.id }));
        return;
      }
    }
    const newMemberId = `m-${Date.now()}`;
    db.trip_members.push({
      id: newMemberId,
      trip_id: invite.trip_id,
      user_id: user.id,
      display_name: body.p_display_name || body.member_name || 'New Member',
      role: 'member',
      left_at: null,
      family_id: null,
      email: null,
      phone: null,
    });
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, trip_id: invite.trip_id, member_id: newMemberId }));
    return;
  }

  if (pathname === '/rest/v1/rpc/save_expense') {
    const body = await parseBody(req);
    const expenseId = body.p_expense_id || `exp-${Date.now()}`;
    const user = getUserFromAuth(req) || { id: '11111111-1111-1111-1111-111111111111' };
    const member = db.trip_members.find((m) => m.trip_id === body.p_trip_id && m.user_id === user.id) || db.trip_members[0];

    const existingIdx = db.expenses.findIndex((e) => e.id === expenseId);
    if (existingIdx >= 0) {
      const exp = db.expenses[existingIdx];
      if (body.p_expected_version && exp.version !== body.p_expected_version) {
        res.writeHead(409);
        res.end(JSON.stringify({ message: 'Version conflict' }));
        return;
      }
      exp.title = body.p_title;
      exp.amount_paise = body.p_amount_paise;
      exp.category = body.p_category;
      exp.paid_by = body.p_paid_by;
      exp.spent_on = body.p_spent_on;
      exp.split_type = body.p_split_type;
      exp.split_input = body.p_split_input;
      exp.note = body.p_note;
      exp.version += 1;
    } else {
      db.expenses.push({
        id: expenseId,
        trip_id: body.p_trip_id,
        title: body.p_title,
        amount_paise: body.p_amount_paise,
        category: body.p_category,
        paid_by: body.p_paid_by,
        spent_on: body.p_spent_on,
        split_type: body.p_split_type,
        split_input: body.p_split_input,
        note: body.p_note,
        created_by: member.id,
        version: 1,
        deleted_at: null,
      });
    }

    // Replace splits
    db.expense_splits = db.expense_splits.filter((s) => s.expense_id !== expenseId);
    if (Array.isArray(body.p_splits)) {
      for (const s of body.p_splits) {
        db.expense_splits.push({
          expense_id: expenseId,
          member_id: s.member_id,
          share_paise: s.share_paise,
        });
      }
    }

    res.writeHead(200);
    res.end(JSON.stringify(expenseId));
    return;
  }

  // Standard REST endpoints
  const table = pathname.replace('/rest/v1/', '').split('?')[0];

  if (table && db[table]) {
    const collection = db[table];

    if (req.method === 'GET') {
      let results = [...collection];

      // Parse PostgREST filters
      for (const [key, value] of url.searchParams.entries()) {
        if (key === 'select') continue;
        if (key === 'order') continue;
        if (key.includes('.')) continue;

        if (value.startsWith('eq.')) {
          const val = value.replace('eq.', '');
          results = results.filter((r) => String(r[key]) === val);
        } else if (value.startsWith('is.')) {
          const val = value.replace('is.', '');
          if (val === 'null') results = results.filter((r) => r[key] === null);
        } else if (value.startsWith('gte.')) {
          const val = value.replace('gte.', '');
          results = results.filter((r) => String(r[key]) >= val);
        } else if (value.startsWith('in.')) {
          const raw = value.replace(/^in\.\((.*)\)$/, '$1');
          const list = raw.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
          results = results.filter((r) => list.includes(String(r[key])));
        }
      }

      // Joins / embedding
      const select = url.searchParams.get('select') || '';
      if (table === 'trip_members') {
        if (select.includes('profiles')) {
          results = results.map((m) => {
            const p = db.profiles.find((pr) => pr.id === m.user_id);
            return { ...m, profiles: p ? { upi_id: p.upi_id } : null };
          });
        }
        if (select.includes('trip_families')) {
          results = results.map((m) => {
            const f = db.trip_families.find((fam) => fam.id === m.family_id);
            return { ...m, trip_families: f ? { id: f.id, name: f.name } : null };
          });
        }
        if (select.includes('trip')) {
          results = results.map((m) => {
            const t = db.trips.find((tr) => tr.id === m.trip_id);
            return { ...m, trip: t };
          });
        }
      }

      if (table === 'invites' && select.includes('trip')) {
        results = results.map((inv) => {
          const t = db.trips.find((tr) => tr.id === inv.trip_id);
          return { ...inv, trip: t };
        });
      }

      if (table === 'expenses' && select.includes('payer')) {
        results = results.map((e) => {
          const m = db.trip_members.find((mem) => mem.id === e.paid_by);
          const splitsCount = db.expense_splits.filter((s) => s.expense_id === e.id).length;
          return {
            ...e,
            payer: m ? { display_name: m.display_name } : { display_name: 'Member' },
            splits: [{ count: splitsCount }],
          };
        });
      }

      if (table === 'settlements' && select.includes('from_member_data')) {
        results = results.map((s) => {
          const fromM = db.trip_members.find((mem) => mem.id === s.from_member);
          const toM = db.trip_members.find((mem) => mem.id === s.to_member);
          return {
            ...s,
            from_member_data: { display_name: fromM?.display_name },
            to_member_data: { display_name: toM?.display_name },
          };
        });
      }

      const isSingle = req.headers['accept']?.includes('vnd.pgrst.object+json');
      if (isSingle) {
        if (results.length === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ message: 'JSON object requested, multiple (or no) rows returned' }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify(results[0]));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify(results));
      return;
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const inserted = Array.isArray(body) ? body : [body];
      for (const item of inserted) {
        if (!item.id && table !== 'category_limits') item.id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (table === 'category_limits') {
          const existIdx = collection.findIndex((c) => c.trip_id === item.trip_id && c.category === item.category);
          if (existIdx >= 0) collection[existIdx] = item;
          else collection.push(item);
        } else {
          collection.push(item);
        }
      }
      res.writeHead(201);
      res.end(JSON.stringify(inserted));
      return;
    }

    if (req.method === 'PATCH') {
      const body = await parseBody(req);
      let targets = [...collection];
      for (const [key, value] of url.searchParams.entries()) {
        if (value.startsWith('eq.')) {
          const val = value.replace('eq.', '');
          targets = targets.filter((item) => String(item[key]) === val);
        } else if (value.startsWith('gte.')) {
          const val = value.replace('gte.', '');
          targets = targets.filter((item) => String(item[key]) >= val);
        } else if (value.startsWith('is.')) {
          const val = value.replace('is.', '');
          if (val === 'null') targets = targets.filter((item) => item[key] === null);
        }
      }
      for (const item of targets) {
        Object.assign(item, body);
      }
      res.writeHead(200);
      res.end(JSON.stringify({ updated: targets.length }));
      return;
    }

    if (req.method === 'DELETE') {
      for (const [key, value] of url.searchParams.entries()) {
        if (value.startsWith('eq.')) {
          const val = value.replace('eq.', '');
          const filtered = collection.filter((item) => String(item[key]) !== val);
          db[table] = filtered;
        }
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

const PORT = 54321;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock Supabase REST & Auth server listening on http://127.0.0.1:${PORT}`);
});
