import { prepareImage, saveImage, readImage, removeImage } from "./images.js";
import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { query, init } from "./db.js";
import {
  parameters,
  calculate,
  validateOccurrence,
  publicRow,
} from "./domain.js";
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const hash = (p) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
};
function matches(p, h) {
  const [salt, key] = h.split(":");
  return timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(key, "hex"));
}
const digest = (t) => createHash("sha256").update(t).digest("hex");
const audit = (u, a, id, detail) =>
  query("INSERT INTO audit VALUES($1,$2,$3,$4,$5,$6)", [
    randomUUID(),
    u?.id || null,
    a,
    id,
    JSON.stringify(detail),
    new Date().toISOString(),
  ]);
function userInput(b) {
  if (
    typeof b.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "") ||
    b.email.length > 150
  )
    throw fail("E-mail inválido.");
  if (
    typeof b.name !== "string" ||
    b.name.trim().length < 2 ||
    b.name.length > 100
  )
    throw fail("Nome inválido.");
  if (
    typeof b.password !== "string" ||
    b.password.length < 10 ||
    b.password.length > 128
  )
    throw fail("Senha deve ter de 10 a 128 caracteres.");
}
async function body(req, limit = 16384) {
  let s = "";
  for await (const c of req) {
    s += c;
    if (Buffer.byteLength(s) > limit) throw fail("Envio muito grande.", 413);
  }
  try {
    return JSON.parse(s || "{}");
  } catch {
    throw fail("JSON inválido.");
  }
}
const limits = new Map();
export async function boot() {
  await init();
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    userInput({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: "Administrador",
    });
    if (
      !(
        await query("SELECT id FROM users WHERE email=$1", [
          process.env.ADMIN_EMAIL.toLowerCase(),
        ])
      ).length
    )
      await query("INSERT INTO users VALUES($1,$2,$3,$4,$5,1)", [
        randomUUID(),
        process.env.ADMIN_EMAIL.toLowerCase(),
        "Administrador",
        hash(process.env.ADMIN_PASSWORD),
        "admin",
      ]);
  }
  // Serializa mutações no processo para evitar aprovações concorrentes de duplicados.
  let writes = Promise.resolve();
  const server = http.createServer(async (req, res) => {
    let release;
    if (req.url.startsWith("/api/") && !["GET", "HEAD"].includes(req.method)) {
      const previous = writes;
      writes = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
    }
    const send = (value, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(value));
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'",
    );
    try {
      const url = new URL(req.url, "http://localhost"),
        p = url.pathname,
        m = req.method;
      if (p.startsWith("/api/")) {
        const key =
          req.socket.remoteAddress +
          ":" +
          (p === "/api/auth/login" ? "login" : "general");
        const now = Date.now();
        let entry = limits.get(key);
        if (!entry || entry.until < now) {
          entry = { count: 0, until: now + 60000 };
          limits.set(key, entry);
        }
        if (++entry.count > (p === "/api/auth/login" ? 10 : 180))
          throw fail("Muitas requisições. Aguarde um minuto.", 429);
        if (limits.size > 10000)
          for (const [k, v] of limits) if (v.until < now) limits.delete(k);
        if (
          !["GET", "HEAD"].includes(m) &&
          req.headers.origin &&
          req.headers.origin !==
            `${process.env.PUBLIC_ORIGIN || "http://" + req.headers.host}`
        )
          throw fail("Origem não permitida.", 403);
        const raw = /am_session=([a-f0-9]+)/.exec(
          req.headers.cookie || "",
        )?.[1];
        const u = raw
          ? (
              await query(
                "SELECT users.id,email,name,role,active FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=$1 AND sessions.expires>$2 AND active=1",
                [digest(raw), now],
              )
            )[0]
          : null;
        const requireRole = (...roles) => {
          if (!u) throw fail("Faça login para continuar.", 401);
          if (roles.length && !roles.includes(u.role))
            throw fail("Você não tem permissão.", 403);
        };
        if (p === "/api/health") return send({ status: "ok" });
        if (p === "/api/auth/me") return send({ user: u || null });
        if (p === "/api/auth/register" && m === "POST") {
          const b = await body(req);
          userInput(b);
          try {
            await query("INSERT INTO users VALUES($1,$2,$3,$4,$5,1)", [
              randomUUID(),
              b.email.toLowerCase(),
              b.name.trim(),
              hash(b.password),
              "citizen",
            ]);
          } catch (e) {
            if (/unique|duplicate/i.test(e.message))
              throw fail("E-mail já cadastrado.", 409);
            throw e;
          }
          return send({ message: "Conta criada." }, 201);
        }
        if (p === "/api/auth/login" && m === "POST") {
          const b = await body(req);
          if (typeof b.password !== "string" || b.password.length > 128)
            throw fail("Credenciais inválidas.", 401);
          const x = (
            await query("SELECT * FROM users WHERE email=$1 AND active=1", [
              String(b.email).toLowerCase(),
            ])
          )[0];
          if (!x || !matches(b.password, x.password))
            throw fail("Credenciais inválidas.", 401);
          const t = randomBytes(32).toString("hex");
          await query("DELETE FROM sessions WHERE expires<$1", [now]);
          await query("INSERT INTO sessions VALUES($1,$2,$3)", [
            digest(t),
            x.id,
            now + 8 * 3600000,
          ]);
          res.setHeader(
            "Set-Cookie",
            `am_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`,
          );
          return send({
            user: { id: x.id, name: x.name, email: x.email, role: x.role },
          });
        }
        if (p === "/api/auth/profile" && m === "PATCH") {
          requireRole();
          const b = await body(req);
          if (
            typeof b.name !== "string" ||
            b.name.trim().length < 2 ||
            b.name.length > 100
          )
            throw fail("Informe um nome de 2 a 100 caracteres.");
          const email = String(b.email || "")
            .trim()
            .toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150)
            throw fail("E-mail inválido.");
          const current = (
            await query("SELECT * FROM users WHERE id=$1", [u.id])
          )[0];
          const changesCredentials =
            email !== current.email || Boolean(b.newPassword);
          if (
            changesCredentials &&
            (typeof b.currentPassword !== "string" ||
              b.currentPassword.length > 128 ||
              !matches(b.currentPassword, current.password))
          )
            throw fail(
              "Informe sua senha atual para alterar e-mail ou senha.",
              403,
            );
          let password = current.password;
          if (b.newPassword) {
            userInput({ name: b.name, email, password: b.newPassword });
            password = hash(b.newPassword);
          }
          try {
            await query(
              "UPDATE users SET name=$1,email=$2,password=$3 WHERE id=$4",
              [b.name.trim(), email, password, u.id],
            );
          } catch (e) {
            if (/unique|duplicate/i.test(e.message))
              throw fail("Este e-mail já está em uso.", 409);
            throw e;
          }
          if (changesCredentials)
            await query("DELETE FROM sessions WHERE user_id=$1 AND token<>$2", [
              u.id,
              digest(raw),
            ]);
          await audit(u, "update-profile", u.id, {
            credentialsChanged: changesCredentials,
          });
          return send({
            user: { id: u.id, name: b.name.trim(), email, role: u.role },
          });
        }
        const photoMatch = p.match(/^\/api\/images\/([a-f0-9-]{36})$/);
        if (photoMatch && m === "GET") {
          const r = (
            await query(
              "SELECT occurrences.id,owner,moderation FROM occurrences JOIN attachments ON occurrences.id=attachments.occurrence_id WHERE occurrences.id=$1",
              [photoMatch[1]],
            )
          )[0];
          if (
            !r ||
            (r.moderation !== "approved" &&
              u?.role !== "admin" &&
              u?.role !== "manager" &&
              u?.id !== r.owner)
          )
            throw fail("Imagem não encontrada.", 404);
          res.setHeader("Content-Type", "image/jpeg");
          res.end(await readImage(r.id));
          return;
        }
        if (p === "/api/auth/logout" && m === "POST") {
          if (raw)
            await query("DELETE FROM sessions WHERE token=$1", [digest(raw)]);
          res.setHeader(
            "Set-Cookie",
            "am_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          );
          return send({ message: "Sessão encerrada." });
        }
        if (p === "/api/users") {
          requireRole("admin");
          if (m === "GET")
            return send(
              await query("SELECT id,email,name,role,active FROM users"),
            );
          if (m === "POST") {
            const b = await body(req);
            userInput(b);
            if (!["citizen", "manager", "admin"].includes(b.role))
              throw fail("Perfil inválido.");
            const id = randomUUID();
            await query("INSERT INTO users VALUES($1,$2,$3,$4,$5,1)", [
              id,
              b.email.toLowerCase(),
              b.name,
              hash(b.password),
              b.role,
            ]);
            await audit(u, "create-user", id, { role: b.role });
            return send({ id }, 201);
          }
        }
        if (p.startsWith("/api/users/") && m === "PATCH") {
          requireRole("admin");
          const id = p.split("/").pop(),
            b = await body(req);
          if (id === u.id) throw fail("Não altere sua própria permissão.");
          if (
            !["citizen", "manager", "admin"].includes(b.role) ||
            ![0, 1].includes(b.active)
          )
            throw fail("Perfil ou situação inválida.");
          await query("UPDATE users SET role=$1,active=$2 WHERE id=$3", [
            b.role,
            b.active,
            id,
          ]);
          await query("DELETE FROM sessions WHERE user_id=$1", [id]);
          await audit(u, "update-user", id, b);
          return send({ message: "Usuário atualizado." });
        }
        if (p === "/api/audit") {
          requireRole("admin");
          return send(
            await query("SELECT * FROM audit ORDER BY created DESC LIMIT 200"),
          );
        }
        if (p === "/api/occurrences" && m === "POST") {
          const b = await body(req, 7 * 1024 * 1024);
          validateOccurrence(b);
          const photo = await prepareImage(b.image);
          const id = randomUUID();
          await query(
            "INSERT INTO occurrences(id,title,neighborhood,type,description,lat,lng,date,owner,contact,created) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
            [
              id,
              b.title.trim(),
              b.neighborhood.trim(),
              b.type,
              b.description.trim(),
              b.lat,
              b.lng,
              b.date,
              u?.id || null,
              b.contact?.trim() || null,
              new Date().toISOString(),
            ],
          );
          if (photo) {
            try {
              await saveImage(id, photo);
              await query("INSERT INTO attachments VALUES($1,$2,$3)", [
                id,
                "image/jpeg",
                photo.length,
              ]);
            } catch (e) {
              await removeImage(id);
              await query("DELETE FROM occurrences WHERE id=$1", [id]);
              throw e;
            }
          }
          await audit(u, "submit", id, { hasImage: Boolean(photo) });
          return send(
            { id, moderation: "pending", message: "Recebido para moderação." },
            201,
          );
        }
        let all = await query(
          "SELECT * FROM occurrences ORDER BY created DESC",
        );
        const attachmentIds = new Set(
          (await query("SELECT occurrence_id FROM attachments")).map(
            (x) => x.occurrence_id,
          ),
        );
        all = all.map((r) => ({
          ...r,
          imageUrl: attachmentIds.has(r.id) ? "/api/images/" + r.id : null,
        }));
        const areas = calculate(all);
        const publicData = all
          .filter((r) => r.moderation === "approved")
          .map((r) => publicRow(r, areas));
        function filtered() {
          let rows = publicData;
          for (const k of ["type", "neighborhood", "criticality"])
            if (url.searchParams.get(k))
              rows = rows.filter((r) => r[k] === url.searchParams.get(k));
          const start = url.searchParams.get("start"),
            end = url.searchParams.get("end");
          for (const date of [start, end])
            if (
              date &&
              (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                isNaN(Date.parse(date)) ||
                new Date(date).toISOString().slice(0, 10) !== date)
            )
              throw fail("Período inválido.");
          if (start && end && start > end)
            throw fail("A data inicial deve anteceder a final.");
          if (start) rows = rows.filter((r) => r.date >= start);
          if (end) rows = rows.filter((r) => r.date <= end);
          return rows;
        }
        if (p === "/api/occurrences" && m === "GET")
          return send({ items: filtered(), parameters });
        if (p === "/api/areas")
          return send({
            items: areas,
            parameters,
            generatedAt: new Date().toISOString(),
            noData: "Células não retornadas não têm dados aprovados na janela.",
          });
        if (p === "/api/mine") {
          requireRole();
          return send(
            all
              .filter((r) => r.owner === u.id)
              .map((r) => ({ ...publicRow(r, areas), reason: r.reason })),
          );
        }
        if (p === "/api/admin/occurrences") {
          requireRole("admin", "manager");
          return send(
            all.map((r) => ({ ...publicRow(r, areas), reason: r.reason })),
          );
        }
        if (p === "/api/reports") {
          requireRole("admin", "manager");
          const rows = filtered(),
            ids = new Set(rows.map((r) => r.cell));
          const report = {
            filters: Object.fromEntries(url.searchParams),
            generatedAt: new Date().toISOString(),
            parameters,
            occurrences: rows,
            areas: areas.filter((a) => ids.has(a.id)),
            limitations:
              "Índice operacional provisório; não prevê alagamentos. Sem relatos não significa ausência de risco.",
          };
          if (url.searchParams.get("format") === "geojson")
            return send({
              type: "FeatureCollection",
              metadata: report,
              features: rows.map((r) => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: [r.lng, r.lat] },
                properties: r,
              })),
            });
          if (url.searchParams.get("format") === "csv") {
            const quote = (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"';
            const keys = [
              "id",
              "title",
              "neighborhood",
              "type",
              "date",
              "lat",
              "lng",
              "score",
              "criticality",
              "cell",
              "recurring",
            ];
            res.writeHead(200, {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="AlagaManaus.csv"',
            });
            return res.end(
              "\ufeff" +
                [
                  ["Gerado", report.generatedAt],
                  ["Parâmetros", JSON.stringify(parameters)],
                  ["Filtros", JSON.stringify(report.filters)],
                  keys,
                  ...rows.map((r) => keys.map((k) => r[k])),
                ]
                  .map((r) => r.map(quote).join(";"))
                  .join("\r\n"),
            );
          }
          return send(report);
        }
        const match = p.match(/^\/api\/occurrences\/([^/]+)(?:\/(moderate))?$/);
        if (match) {
          const r = all.find((x) => x.id === match[1]);
          if (!r) throw fail("Ocorrência não encontrada.", 404);
          if (m === "GET") {
            if (
              r.moderation !== "approved" &&
              !["admin", "manager"].includes(u?.role) &&
              u?.id !== r.owner
            )
              throw fail("Ocorrência não encontrada.", 404);
            return send({
              ...publicRow(r, areas),
              reason: r.moderation === "approved" ? undefined : r.reason,
            });
          }
          requireRole("admin");
          if (m === "DELETE") {
            await query("DELETE FROM occurrences WHERE id=$1", [r.id]);
            if (attachmentIds.has(r.id)) await removeImage(r.id);
            await audit(u, "delete", r.id, { title: r.title });
            return send({ message: "Excluído." });
          }
          const b = await body(req);
          if (match[2] && m === "POST") {
            if (
              !["approved", "rejected", "pending"].includes(b.moderation) ||
              typeof b.reason !== "string" ||
              b.reason.length < 3 ||
              b.reason.length > 500
            )
              throw fail(
                "Informe decisão e justificativa de 3 a 500 caracteres.",
              );
            if (b.moderation === "approved") {
              const duplicate = all.some(
                (x) =>
                  x.id !== r.id &&
                  x.moderation === "approved" &&
                  x.type === r.type &&
                  x.date === r.date &&
                  Math.hypot(
                    (x.lat - r.lat) * 111000,
                    (x.lng - r.lng) * 111000,
                  ) < 25,
              );
              if (duplicate)
                throw fail(
                  "Possível duplicidade: mesmo tipo, data e ponto a menos de 25 m. Rejeite ou corrija o registro.",
                  409,
                );
            }
            await query(
              "UPDATE occurrences SET moderation=$1,reason=$2 WHERE id=$3",
              [b.moderation, b.reason, r.id],
            );
            await audit(u, "moderate", r.id, b);
            return send({ message: "Moderação salva." });
          }
          if (m === "PATCH") {
            const updated = { ...r, ...b };
            validateOccurrence(updated);
            if (
              !["em_analise", "em_atendimento", "resolvido"].includes(
                updated.status,
              )
            )
              throw fail("Status inválido.");
            await query(
              "UPDATE occurrences SET title=$1,neighborhood=$2,type=$3,description=$4,lat=$5,lng=$6,date=$7,status=$8,moderation=$9 WHERE id=$10",
              [
                updated.title,
                updated.neighborhood,
                updated.type,
                updated.description,
                updated.lat,
                updated.lng,
                updated.date,
                updated.status,
                "pending",
                r.id,
              ],
            );
            await audit(u, "edit", r.id, { ...publicRow(updated, areas) });
            return send({ message: "Editado; requer nova aprovação." });
          }
        }
        throw fail("Rota não encontrada.", 404);
      }
      if (!["GET", "HEAD"].includes(m))
        throw fail("Método não permitido.", 405);
      const relative =
        p === "/" ? "index.html" : decodeURIComponent(p).slice(1);
      if (
        !/^(index\.html|src\/(css|js)\/[\w.-]+\.(css|js)|public\/assets\/[\w/.-]+)$/.test(
          relative,
        )
      )
        throw fail("Arquivo não encontrado.", 404);
      const data = await fs.readFile(path.resolve(relative));
      res.setHeader(
        "Content-Type",
        relative.endsWith(".html")
          ? "text/html; charset=utf-8"
          : relative.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : relative.endsWith(".css")
              ? "text/css; charset=utf-8"
              : relative.endsWith(".png")
                ? "image/png"
                : relative.endsWith(".svg")
                  ? "image/svg+xml"
                  : "application/octet-stream",
      );
      res.end(data);
    } catch (e) {
      if (!e.status && e.code !== "ENOENT") console.error(e);
      send(
        {
          error: e.status
            ? e.message
            : e.code === "ENOENT"
              ? "Arquivo não encontrado."
              : "Erro interno do servidor.",
        },
        e.status || (e.code === "ENOENT" ? 404 : 500),
      );
    } finally {
      release?.();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = await boot();
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? "A porta " +
            (process.env.PORT || 3000) +
            " já está ocupada. Encerre o outro servidor com Ctrl+C antes de iniciar novamente."
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        "AlagaManaus: http://localhost:" + (process.env.PORT || 3000),
      ),
  );
}
