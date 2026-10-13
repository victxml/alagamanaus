import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alagamanaus-"));
process.env.SQLITE_PATH = path.join(dir, "test.sqlite");
process.env.UPLOAD_DIR = path.join(dir, "uploads");
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "Administrador123!";
const { boot } = await import("../backend/server.js");
const { query, close } = await import("../backend/db.js");
const { calculate, validateOccurrence, inManaus, cell } =
  await import("../backend/domain.js");
const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Manaus",
  }),
  yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", {
    timeZone: "America/Manaus",
  });
const valid = {
  title: "Rua de teste",
  neighborhood: "Redenção",
  type: "alagamento",
  description: "Ocorrência acadêmica de teste.",
  lat: -3.0937,
  lng: -60.0212,
  date: today,
  contact: "privado@example.com",
};
const server = await boot();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
async function request(p, method = "GET", data, cookie = "", headers = {}) {
  const r = await fetch(base + "/api" + p, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const text = await r.text();
  return {
    status: r.status,
    body: r.headers.get("content-type")?.includes("json")
      ? JSON.parse(text)
      : text,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
test("Regras territoriais, datas e fórmula", () => {
  assert(inManaus(valid.lat, valid.lng));
  assert(!inManaus(-23.55, -46.63));
  assert.throws(() =>
    validateOccurrence({ ...valid, lat: -23.55, lng: -46.63 }),
  );
  assert.throws(() => validateOccurrence({ ...valid, title: "" }));
  assert.throws(() => validateOccurrence({ ...valid, date: "2026-02-30" }));
  assert.throws(() => validateOccurrence({ ...valid, type: "outro" }));
  const rows = [
    { ...valid, moderation: "approved" },
    { ...valid, moderation: "approved", date: yesterday },
    { ...valid, moderation: "pending" },
    { ...valid, moderation: "rejected" },
    { ...valid, moderation: "approved", type: "residuo" },
  ];
  const a = calculate(rows)[0];
  assert.equal(a.score, 34);
  assert.equal(a.criticality, "medio");
  assert(a.recurring);
  assert.equal(calculate([]).length, 0);
  assert.equal(
    calculate(rows.map((x) => ({ ...x, date: "2000-01-01" }))).length,
    0,
  );
  assert.equal(cell(valid.lat, valid.lng), a.id);
  assert.equal(a.geometry.coordinates[0].length, 5);
});
test("Fluxo completo, privacidade, permissões, duplicidade, filtros e relatórios", async () => {
  assert.equal((await request("/admin/occurrences")).status, 401);
  const admin = (
    await request("/auth/login", "POST", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).cookie;
  assert(admin);
  assert.equal(
    (
      await request("/auth/register", "POST", {
        name: "Cidadão",
        email: "cid@test.local",
        password: "Cidadao123!",
      })
    ).status,
    201,
  );
  const citizen = (
    await request("/auth/login", "POST", {
      email: "cid@test.local",
      password: "Cidadao123!",
    })
  ).cookie;
  const submitted = await request("/occurrences", "POST", valid, citizen);
  assert.equal(submitted.status, 201);
  const id = submitted.body.id;
  assert.equal((await request("/occurrences")).body.items.length, 0);
  assert.equal((await request("/occurrences/" + id)).status, 404);
  assert.equal((await request("/mine", "GET", null, citizen)).body.length, 1);
  assert.equal(
    (
      await request(
        "/occurrences/" + id + "/moderate",
        "POST",
        { moderation: "approved", reason: "Teste aprovado" },
        citizen,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/occurrences/" + id + "/moderate",
        "POST",
        { moderation: "approved", reason: "Teste aprovado" },
        admin,
      )
    ).status,
    200,
  );
  const pub = (await request("/occurrences")).body.items;
  assert.equal(pub.length, 1);
  assert(!JSON.stringify(pub).includes("privado@example.com"));
  assert(!("owner" in pub[0]));
  assert.equal(pub[0].score, 14);
  assert.equal(
    (await request("/occurrences?neighborhood=Outro")).body.items.length,
    0,
  );
  assert.equal(
    (await request("/occurrences?type=residuo")).body.items.length,
    0,
  );
  assert.equal(
    (await request("/occurrences?start=2099-01-01")).body.items.length,
    0,
  );
  const duplicate = (await request("/occurrences", "POST", valid)).body.id;
  assert.equal(
    (
      await request(
        "/occurrences/" + duplicate + "/moderate",
        "POST",
        { moderation: "approved", reason: "Aprovar repetido" },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/occurrences/" + duplicate + "/moderate",
        "POST",
        { moderation: "rejected", reason: "Duplicidade identificada" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/users",
        "POST",
        {
          name: "Gestor",
          email: "gestor@test.local",
          password: "Gestor123!",
          role: "manager",
        },
        admin,
      )
    ).status,
    201,
  );
  const manager = (
    await request("/auth/login", "POST", {
      email: "gestor@test.local",
      password: "Gestor123!",
    })
  ).cookie;
  assert.equal(
    (await request("/occurrences/" + id, "DELETE", null, manager)).status,
    403,
  );
  assert.equal((await request("/users", "GET", null, manager)).status, 403);
  assert.equal((await request("/reports", "GET", null, citizen)).status, 403);
  const report = (
    await request("/reports?type=alagamento", "GET", null, manager)
  ).body;
  assert.equal(report.occurrences.length, 1);
  assert.equal(report.parameters.version, "AM-1.0");
  assert(report.generatedAt);
  assert(!JSON.stringify(report).includes("privado@example.com"));
  const geo = (await request("/reports?format=geojson", "GET", null, manager))
    .body;
  assert.deepEqual(geo.features[0].geometry.coordinates, [
    valid.lng,
    valid.lat,
  ]);
  assert.equal(
    (await request("/reports?format=csv", "GET", null, manager)).status,
    200,
  );
  assert.equal(
    (
      await request("/occurrences", "POST", valid, "", {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/occurrences", "POST", {
        ...valid,
        lat: -23.55,
        lng: -46.63,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/occurrences/" + id,
        "PATCH",
        { description: "Texto revisado pelo administrador." },
        admin,
      )
    ).status,
    200,
  );
  assert.equal((await request("/occurrences")).body.items.length, 0);
  assert.equal(
    (
      await request(
        "/occurrences/" + id + "/moderate",
        "POST",
        { moderation: "approved", reason: "Revisão concluída" },
        admin,
      )
    ).status,
    200,
  );
  const one = (
    await request("/occurrences", "POST", { ...valid, type: "residuo" })
  ).body.id;
  const two = (
    await request("/occurrences", "POST", { ...valid, type: "residuo" })
  ).body.id;
  const approvals = await Promise.all(
    [one, two].map((id) =>
      request(
        "/occurrences/" + id + "/moderate",
        "POST",
        { moderation: "approved", reason: "Concorrência controlada" },
        admin,
      ),
    ),
  );
  assert.deepEqual(approvals.map((x) => x.status).sort(), [200, 409]);
  assert.equal((await request("/audit", "GET", null, admin)).status, 200);
  assert.equal(
    (await request("/auth/logout", "POST", {}, citizen)).status,
    200,
  );
  assert.equal((await request("/mine", "GET", null, citizen)).status, 401);
});
test("Foto opcional: validação, privacidade, publicação, limpeza e perfil", async () => {
  const sharp = (await import("sharp")).default;
  const raw = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#075b65" },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const photo = "data:image/jpeg;base64," + raw.toString("base64");
  await request("/auth/register", "POST", {
    name: "Pessoa Foto",
    email: "foto@test.local",
    password: "Foto123456!",
  });
  const citizen = (
    await request("/auth/login", "POST", {
      email: "foto@test.local",
      password: "Foto123456!",
    })
  ).cookie;
  const admin = (
    await request("/auth/login", "POST", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).cookie;
  const before = (await query("SELECT id FROM occurrences")).length;
  assert.equal(
    (
      await request(
        "/occurrences",
        "POST",
        { ...valid, image: "data:image/png;base64,YWJj" },
        citizen,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/occurrences",
        "POST",
        { ...valid, image: "data:image/svg+xml;base64,YWJj" },
        citizen,
      )
    ).status,
    400,
  );
  assert.equal((await query("SELECT id FROM occurrences")).length, before);
  const submitted = await request(
    "/occurrences",
    "POST",
    { ...valid, lat: -3.095, type: "residuo", image: photo },
    citizen,
  );
  assert.equal(submitted.status, 201);
  const id = submitted.body.id;
  assert.equal((await fetch(base + "/api/images/" + id)).status, 404);
  const owned = await fetch(base + "/api/images/" + id, {
    headers: { Cookie: citizen },
  });
  assert.equal(owned.status, 200);
  assert.equal(owned.headers.get("content-type"), "image/jpeg");
  const clean = await sharp(Buffer.from(await owned.arrayBuffer())).metadata();
  assert(!clean.exif);
  assert(!clean.icc);
  assert.equal(
    (await request("/mine", "GET", null, citizen)).body[0].imageUrl,
    "/api/images/" + id,
  );
  assert.equal(
    (
      await request(
        "/occurrences/" + id + "/moderate",
        "POST",
        { moderation: "approved", reason: "Foto pertinente ao relato" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal((await fetch(base + "/api/images/" + id)).status, 200);
  assert.equal(
    (
      await request(
        "/auth/profile",
        "PATCH",
        { name: "Nome atualizado", email: "foto@test.local" },
        citizen,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/auth/profile",
        "PATCH",
        { name: "Nome atualizado", email: "novo@test.local" },
        citizen,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/auth/profile",
        "PATCH",
        {
          name: "Nome atualizado",
          email: "novo@test.local",
          currentPassword: "Foto123456!",
          newPassword: "NovaFoto123!",
        },
        citizen,
      )
    ).status,
    200,
  );
  const updated = await request("/auth/login", "POST", {
    email: "novo@test.local",
    password: "NovaFoto123!",
  });
  assert.equal(updated.status, 200);
  const count = (await query("SELECT id FROM users")).length;
  const { init } = await import("../backend/db.js");
  await init();
  assert.equal((await query("SELECT id FROM users")).length, count);
  assert.equal(
    (await query("SELECT occurrence_id FROM attachments")).length,
    1,
  );
  assert.equal(
    (await request("/occurrences/" + id, "DELETE", null, admin)).status,
    200,
  );
  assert(!fs.existsSync(path.join(dir, "uploads", id + ".jpg")));
  assert.equal((await fetch(base + "/api/images/" + id)).status, 404);
});
test("1.000 ocorrências: 30 filtros com p95 menor que 2 s", async () => {
  for (let i = 0; i < 1000; i++)
    await query(
      "INSERT INTO occurrences(id,title,neighborhood,type,description,lat,lng,date,moderation,created) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        "perf-" + i,
        "Teste " + i,
        "Redenção",
        "alagamento",
        valid.description,
        valid.lat,
        valid.lng,
        today,
        "approved",
        new Date().toISOString(),
      ],
    );
  const times = [];
  for (let i = 0; i < 30; i++) {
    const t = performance.now();
    const r = await request(
      "/occurrences?neighborhood=Reden%C3%A7%C3%A3o&type=alagamento",
    );
    assert.equal(r.status, 200);
    assert(r.body.items.length >= 1000);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log("API p95 em localhost:", times[28].toFixed(1), "ms");
  assert(times[28] < 2000);
});
test.after(async () => {
  await new Promise((r) => server.close(r));
  await close();
  fs.rmSync(dir, { recursive: true, force: true });
});
