/**
 * Cloudflare Worker for V-MARKET
 * File: worker/index.js
 *
 * Handles:
 * - Discord OAuth 2.0 Authorization & Callback (Secure Client Secret in Worker Secrets)
 * - Cloudflare D1 SQL query execution for Products, Orders, Deposits, Users, Inquiries
 * - Session verification & token exchange
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://v-market.pages.dev",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};
const ADMIN_DISCORD_ID = "1547549857231675411";

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const sessionUser = await readSessionUser(request, env);

    try {
      // 1. Discord OAuth Redirect Endpoint
      if (pathname === "/api/auth/discord/login") {
        const clientId = env.DISCORD_CLIENT_ID;
        const redirectUri = encodeURIComponent(env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`);
        const scope = encodeURIComponent("identify email");
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
        return Response.redirect(discordAuthUrl, 302);
      }

      // 2. Discord OAuth Callback Endpoint
      if (pathname === "/api/auth/discord/callback") {
        const code = url.searchParams.get("code");
        if (!code) {
          return new Response(JSON.stringify({ error: "Missing authorization code" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
          });
        }

        // Exchange code for Access Token securely on server-side
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET, // Protected! Never exposed in client code
            grant_type: "authorization_code",
            code: code,
            redirect_uri: env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`,
          }),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          return new Response(JSON.stringify({ error: "Discord token exchange failed", details: errText }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
          });
        }

        const tokenData = await tokenResponse.json();

        // Fetch User Profile from Discord API
        const userResponse = await fetch("https://discord.com/api/users/@me", {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        const userData = await userResponse.json();

        // Upsert user into Cloudflare D1
        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO users (id, username, discriminator, avatar_url, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              username = excluded.username,
              avatar_url = excluded.avatar_url,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            userData.id,
            userData.username,
            userData.discriminator || "0",
            userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null
          ).run();
        }

        const role = userData.id === ADMIN_DISCORD_ID ? "admin" : "user";
        const session = await createSession({ id: userData.id, username: userData.username, role }, env);
        const clientReturnUrl = env.FRONTEND_URL || "https://v-market.pages.dev";
        return new Response(null, { status: 302, headers: {
          Location: `${clientReturnUrl}?login_success=1`,
          "Set-Cookie": `vm_session=${session}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800`
        }});
      }

      if (pathname === "/api/auth/me") {
        if (!sessionUser) return errorResponse("Not authenticated", 401);
        const dbUser = env.DB ? await env.DB.prepare("SELECT id, username, points, role FROM users WHERE id = ?").bind(sessionUser.id).first() : null;
        return jsonResponse({ ...sessionUser, points: dbUser?.points ?? 0, role: dbUser?.role || sessionUser.role });
      }

      const adminOnlyRequest =
        (pathname === "/api/products" && request.method === "POST") ||
        (pathname.startsWith("/api/products/") && request.method !== "GET") ||
        (pathname.startsWith("/api/deposits/") && pathname.endsWith("/approve")) ||
        (pathname.startsWith("/api/inquiries/") && pathname.endsWith("/reply"));

      if ((pathname.startsWith("/api/admin/") || adminOnlyRequest) && sessionUser?.id !== ADMIN_DISCORD_ID) {
        return errorResponse("관리자 권한이 없습니다.", 403);
      }

      // 3. Products API (D1)
      if (pathname === "/api/products") {
        if (request.method === "GET") {
          if (!env.DB) {
            return fallbackProductsResponse();
          }
          const { results } = await env.DB.prepare("SELECT * FROM products WHERE status = 'active' ORDER BY id ASC").all();
          return jsonResponse(results);
        }

        if (request.method === "POST") {
          const body = await request.json();
          const { title, description, skins, price, stock, server, details } = body;
          const result = await env.DB.prepare(`
            INSERT INTO products (title, description, skins, price, stock, server, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(title, description, skins, price, stock, server || '한국 (KR)', details || '').run();

          return jsonResponse({ success: true, id: result.meta.last_row_id });
        }
      }

      // Single Product CRUD
      if (pathname.startsWith("/api/products/")) {
        const id = pathname.split("/").pop();
        if (request.method === "PUT") {
          const body = await request.json();
          const { title, description, price, stock, skins, server, details } = body;
          await env.DB.prepare(`
            UPDATE products SET
              title = ?, description = ?, price = ?, stock = ?, skins = ?, server = ?, details = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(title, description, price, stock, skins, server, details, id).run();
          return jsonResponse({ success: true });
        }

        if (request.method === "DELETE") {
          await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true });
        }
      }

      // 4. Deposits API (D1)
      if (pathname === "/api/deposits") {
        if (request.method === "GET") {
          const { results } = sessionUser.role === "admin"
            ? await env.DB.prepare("SELECT * FROM deposits ORDER BY created_at DESC").all()
            : await env.DB.prepare("SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC").bind(sessionUser.id).all();
          return jsonResponse(results);
        }

        if (request.method === "POST") {
          const body = await request.json();
          const { user_id, user_name, amount, depositor_name, bank_name } = body;
          const res = await env.DB.prepare(`
            INSERT INTO deposits (user_id, user_name, amount, depositor_name, bank_name, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
          `).bind(user_id, user_name, amount, depositor_name, bank_name).run();
          return jsonResponse({ success: true, id: res.meta.last_row_id });
        }
      }

      // 5. Deposit Approval / Action
      if (pathname.startsWith("/api/deposits/") && pathname.endsWith("/approve")) {
        const id = pathname.split("/")[3];
        const deposit = await env.DB.prepare("SELECT * FROM deposits WHERE id = ?").bind(id).first();
        if (!deposit) {
          return errorResponse("Deposit not found", 404);
        }

        // Approve and update user points inside transaction
        await env.DB.batch([
          env.DB.prepare("UPDATE deposits SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
          env.DB.prepare("UPDATE users SET points = points + ? WHERE id = ?").bind(deposit.amount, deposit.user_id)
        ]);

        return jsonResponse({ success: true, message: "Point granted successfully" });
      }

      // 6. Orders API (Purchase execution)
      if (pathname === "/api/orders") {
        if (request.method === "GET") {
          const { results } = sessionUser.role === "admin"
            ? await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC").all()
            : await env.DB.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(sessionUser.id).all();
          return jsonResponse(results);
        }

        if (request.method === "POST") {
          const { product_id } = await request.json();
          const user_id = sessionUser.id;

          // Check balance & product
          const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user_id).first();
          const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(product_id).first();

          if (!user || !product) {
            return errorResponse("User or product not found", 404);
          }
          if (user.points < product.price) {
            return errorResponse("포인트가 부족합니다.", 400);
          }
          if (product.stock <= 0) {
            return errorResponse("재고가 소진되었습니다.", 400);
          }

          // Fetch pre-stocked credential if available
          const stockItem = await env.DB.prepare("SELECT * FROM accounts WHERE product_id = ? AND is_sold = 0 LIMIT 1").bind(product_id).first();
          const accountData = stockItem ? stockItem.credentials : `vlr_kr_${Math.random().toString(36).substring(2, 7)}:safePW!${Math.floor(1000 + Math.random() * 9000)}`;

          const orderNum = `ORD-${Date.now().toString().slice(-8)}`;

          await env.DB.batch([
            env.DB.prepare("UPDATE users SET points = points - ? WHERE id = ?").bind(product.price, user_id),
            env.DB.prepare("UPDATE products SET stock = stock - 1 WHERE id = ?").bind(product_id),
            env.DB.prepare(`
              INSERT INTO orders (order_number, user_id, user_name, product_id, product_title, price, account_data, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
            `).bind(orderNum, user.id, user.username, product.id, product.title, product.price, accountData),
            stockItem ? env.DB.prepare("UPDATE accounts SET is_sold = 1 WHERE id = ?").bind(stockItem.id) : env.DB.prepare("SELECT 1")
          ]);

          return jsonResponse({
            success: true,
            order_number: orderNum,
            account_data: accountData
          });
        }
      }

      // 7. Support Inquiries API
      if (pathname === "/api/inquiries") {
        if (request.method === "GET") {
          const { results } = sessionUser.role === "admin"
            ? await env.DB.prepare("SELECT * FROM inquiries ORDER BY created_at DESC").all()
            : await env.DB.prepare("SELECT * FROM inquiries WHERE user_id = ? ORDER BY created_at DESC").bind(sessionUser.id).all();
          return jsonResponse(results);
        }

        if (request.method === "POST") {
          const { title, message } = await request.json();
          const res = await env.DB.prepare(`
            INSERT INTO inquiries (user_id, user_name, title, message)
            VALUES (?, ?, ?, ?)
          `).bind(sessionUser.id, sessionUser.username, title, message).run();
          return jsonResponse({ success: true, id: res.meta.last_row_id });
        }
      }

      // Inquiry reply
      if (pathname.startsWith("/api/inquiries/") && pathname.endsWith("/reply")) {
        const id = pathname.split("/")[3];
        const { reply } = await request.json();
        await env.DB.prepare("UPDATE inquiries SET reply = ?, status = 'answered', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(reply, id).run();
        return jsonResponse({ success: true });
      }

      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

function errorResponse(msg, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

function fallbackProductsResponse() {
  return jsonResponse([
    { id: 1, title: "스킨 0~10", description: "스킨 0~10개짜리 계정", price: 10, stock: 62, skins: "0~10개 무작위", server: "한국 (KR)" },
    { id: 2, title: "스킨 11~20", description: "스킨 11~20개짜리 계정", price: 50, stock: 45, skins: "11~20개 무작위", server: "한국 (KR)" },
    { id: 3, title: "스킨 21~30", description: "스킨 21~30개짜리 계정", price: 100, stock: 28, skins: "21~30개 무작위", server: "한국 (KR)" },
    { id: 4, title: "스킨 31~40", description: "스킨 31~40개짜리 계정", price: 300, stock: 14, skins: "31~40개 무작위", server: "한국 (KR)" }
  ]);
}

async function createSession(user, env) {
  const payload = base64UrlEncode(JSON.stringify(user));
  const secret = env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET || "change-this-secret";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))}`;
}

async function readSessionUser(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)vm_session=([^;]+)/);
  if (!match) return null;
  const parts = match[1].split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const secret = env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET || "change-this-secret";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signatureBytes = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/") + "=="), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(payload));
  if (!valid) return null;
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/") + "=="));
  } catch {
    return null;
  }
}

function base64UrlEncode(value) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
