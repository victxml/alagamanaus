"use strict";
const civilDate = (date = new Date()) =>
  date.toLocaleDateString("en-CA", { timeZone: "America/Manaus" });
const $ = (id) => document.getElementById(id),
  esc = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const labels = {
    baixo: "Baixa",
    medio: "Moderada",
    alto: "Alta",
    sem_dados: "Sem dados",
  },
  statuses = {
    em_analise: "Em análise",
    em_atendimento: "Em atendimento",
    resolvido: "Resolvido",
  },
  decisions = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
  };
let selectedPhoto = null,
  photoReady = Promise.resolve();
let user = null,
  items = [],
  areas = [],
  adminItems = [],
  map,
  layer,
  areaLayer,
  picker,
  point,
  detailId,
  filterQuery = "";
function toast(s) {
  $("toast").textContent = s;
  $("toast").classList.remove("hidden");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => $("toast").classList.add("hidden"),
    6000,
  );
}
async function api(p, method = "GET", data) {
  const r = await fetch("/api" + p, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw Error(
      "Não conseguimos acessar o servidor. Abra o sistema pelo endereço indicado no terminal, em vez do Live Server.",
    );
  const b = await r.json();
  if (!r.ok) throw Error(b.error || "Falha na solicitação.");
  return b;
}
const safe =
  (fn) =>
  async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      toast(e.message);
    }
  };
function badge(x) {
  return `<span class="badge ${x.criticality}">${labels[x.criticality]}${x.score == null ? "" : ` · ${x.score}/100`}</span>`;
}
function photoMarkup(x) {
  return x.imageUrl
    ? `<figure class="occurrence-photo"><img src="${esc(x.imageUrl)}" alt="Foto anexada à ocorrência ${esc(x.title)}" loading="lazy" /><figcaption>Foto enviada junto ao relato.</figcaption></figure>`
    : "";
}
function areaName(a) {
  const item = items.find((x) => x.cell === a.id);
  return item ? `Região de ${item.neighborhood}` : "Área registrada no mapa";
}
function formatDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("pt-BR");
}
function cards(rows) {
  return (
    rows
      .map(
        (x) =>
          `<article class="panel"><h3><a href="#detalhe-${x.id}">${esc(x.title)}</a></h3><p>${esc(x.neighborhood)} · ${formatDate(x.date)} · ${x.type === "alagamento" ? "Alagamento" : "Resíduos"}</p>${badge(x)}<p>${esc(x.description)}</p></article>`,
      )
      .join("") || "<p>Nenhuma ocorrência aprovada corresponde à consulta.</p>"
  );
}
async function refresh() {
  const b = await api("/occurrences");
  items = b.items;
  areas = (await api("/areas")).items;
  const selected = $("filterNeighborhood").value;
  $("filterNeighborhood").innerHTML =
    '<option value="">Todos os bairros</option>' +
    [...new Set(items.map((x) => x.neighborhood))]
      .sort()
      .map((n) => `<option value="${esc(n)}">${esc(n)}</option>`)
      .join("");
  $("filterNeighborhood").value = selected;
  $("statTotal").textContent = items.length;
  $("statCritical").textContent = areas.filter(
    (x) => x.criticality === "alto",
  ).length;
  $("statResolved").textContent = items.filter(
    (x) => x.status === "resolvido",
  ).length;
  const counts = {};
  items.forEach(
    (x) => (counts[x.neighborhood] = (counts[x.neighborhood] || 0) + 1),
  );
  $("statNeighborhood").textContent =
    Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "—";
  const ranking = [...areas].sort((a, b) => b.score - a.score);
  $("rankingList").innerHTML =
    ranking
      .map(
        (a, i) =>
          `<article class="ranking-item"><span class="rank-number">${i + 1}</span><div><strong>${esc(areaName(a))}</strong><small>${a.a} alagamento(s), ${a.r} resíduo(s) · ${a.recurring ? "Recorrente" : "Ainda sem repetição em dias diferentes"}</small></div>${badge(a)}</article>`,
      )
      .join("") || "<p>Sem dados aprovados nos últimos 90 dias.</p>";
  const first = ranking[0];
  $("criticalityScore").textContent = first?.score ?? "—";
  $("criticalityPointName").textContent = first ? areaName(first) : "Sem dados";
  $("criticalityBadge").textContent = labels[first?.criticality || "sem_dados"];
  $("criticalityBadge").className =
    "badge " + (first?.criticality || "sem_dados");
  document
    .querySelector(".score-ring")
    .setAttribute(
      "aria-label",
      first ? `Índice ${first.score} de 100` : "Sem dados",
    );
  $("heroPriorityName").textContent = first ? areaName(first) : "Sem dados";
  document.querySelector(".hero-score strong").textContent =
    first?.score ?? "—";
  document.querySelector(".priority-spotlight .badge").textContent =
    labels[first?.criticality || "sem_dados"];
  const ring = document.querySelector(".score-ring");
  ring.style.setProperty("--score", first?.score || 0);
  ring.style.setProperty(
    "--score-color",
    color(first?.criticality || "sem_dados"),
  );
  $("criticalityExplanation").textContent = first
    ? first.criticality === "alto"
      ? "Esta área concentra mais registros e merece maior prioridade de acompanhamento."
      : first.criticality === "medio"
        ? "Os relatos desta área indicam uma prioridade intermediária de acompanhamento."
        : "Esta área tem menor pontuação no conjunto de relatos disponíveis. Continue acompanhando os registros."
    : "Ainda não há relatos aprovados nos últimos 90 dias para calcular uma prioridade.";
  $("criticalityCounts").textContent = first
    ? `${first.a} relato(s) de alagamento e ${first.r} de resíduos nos últimos 90 dias. ${first.recurring ? "Alagamentos registrados em dias diferentes." : "Ainda não há repetição de alagamentos em dias diferentes."}`
    : "Novos registros passam por análise antes de aparecer aqui.";
  $("homePriorities").innerHTML = cards(items.slice(0, 3));
  await filters();
}
function queryFilters() {
  const q = new URLSearchParams();
  for (const [id, k] of [
    ["filterNeighborhood", "neighborhood"],
    ["filterType", "type"],
    ["filterCriticality", "criticality"],
  ])
    if ($(id).value) q.set(k, $(id).value);
  const days = Number($("filterPeriod").value);
  if (days)
    q.set("start", civilDate(new Date(Date.now() - (days - 1) * 86400000)));
  return q.toString();
}
async function filters() {
  filterQuery = queryFilters();
  const b = await api("/occurrences?" + filterQuery);
  draw(b.items);
  $("filterResult").textContent =
    b.items.length + " ocorrência(s) aprovada(s).";
  $("mapResults").innerHTML = cards(b.items);
}
function draw(rows) {
  if (!layer) return;
  layer.clearLayers();
  areaLayer.clearLayers();
  for (const a of areas)
    L.geoJSON(
      { type: "Feature", geometry: a.geometry, properties: {} },
      { style: { color: color(a.criticality), weight: 1, fillOpacity: 0.15 } },
    )
      .bindPopup(
        `Célula ${esc(a.id)} · ${labels[a.criticality]} · ${a.score}/100`,
      )
      .addTo(areaLayer);
  for (const x of rows)
    L.circleMarker([x.lat, x.lng], { radius: 9, color: color(x.criticality) })
      .bindPopup(
        `<strong>${esc(x.title)}</strong><p>${esc(x.date)} · ${badge(x)}</p><a href="#detalhe-${x.id}">Ver detalhes</a>`,
      )
      .addTo(layer);
}
function color(c) {
  return {
    baixo: "#16794a",
    medio: "#a66b00",
    alto: "#b42318",
    sem_dados: "#64748b",
  }[c];
}
function initMap() {
  if (!window.L) {
    $("mapLoading").classList.add("hidden");
    $("mapError").classList.remove("hidden");
    return;
  }
  if (!map) {
    map = L.map("map").setView([-3.0937, -60.0212], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    })
      .on("tileerror", () => $("mapError").classList.remove("hidden"))
      .addTo(map);
    areaLayer = L.layerGroup().addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  map.invalidateSize();
  $("mapLoading").classList.add("hidden");
  safe(filters)();
}
function setPoint(lat, lng) {
  $("latitude").value = lat.toFixed(6);
  $("longitude").value = lng.toFixed(6);
  if (picker) {
    if (point) point.setLatLng([lat, lng]);
    else
      point = L.marker([lat, lng], { draggable: true })
        .addTo(picker)
        .on("dragend", () => {
          const p = point.getLatLng();
          setPoint(p.lat, p.lng);
        });
    picker.panTo([lat, lng]);
  }
}
function initPicker() {
  if (!window.L) return;
  if (!picker) {
    picker = L.map("pickerMap").setView([-3.0937, -60.0212], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(picker);
    picker.on("click", (e) => setPoint(e.latlng.lat, e.latlng.lng));
  }
  picker.invalidateSize();
}
async function profile() {
  user = (await api("/auth/me")).user;
  $("profileGuest").classList.toggle("hidden", Boolean(user));
  $("profileAuthenticated").classList.toggle("hidden", !user);
  if (!user) {
    $("profileOccurrences").innerHTML = "";
    return;
  }
  $("profileTitle").textContent = user.name;
  $("profileRole").textContent =
    user.role === "admin"
      ? "Conta administrativa"
      : user.role === "manager"
        ? "Conta de gestor"
        : "Minha conta";
  $("profileEmail").textContent = user.email;
  $("profileAvatar").textContent = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  $("profileNameInput").value = user.name;
  $("profileEmailInput").value = user.email;
  const rows = await api("/mine");
  for (const [id, fn] of [
    ["profileCount", () => true],
    ["profilePending", (x) => x.moderation === "pending"],
    ["profileApproved", (x) => x.moderation === "approved"],
    ["profileRejected", (x) => x.moderation === "rejected"],
  ])
    $(id).textContent = rows.filter(fn).length;
  $("profileOccurrences").innerHTML = rows.length
    ? rows
        .map(
          (x) =>
            `<article class="my-occurrence"><div class="my-occurrence-heading"><div><span class="eyebrow">${x.type === "alagamento" ? "Alagamento" : "Descarte de resíduos"} · ${formatDate(x.date)}</span><h3><a href="#detalhe-${x.id}">${esc(x.title)}</a></h3><p>${esc(x.neighborhood)}</p></div><span class="decision-badge ${x.moderation}">${decisions[x.moderation]}</span></div><p>${esc(x.description)}</p>${x.imageUrl ? '<span class="photo-indicator">Foto anexada</span>' : ""}<div class="moderation-note"><strong>${x.moderation === "pending" ? "Próximo passo" : x.moderation === "approved" ? "Publicado no mapa" : "Decisão da análise"}</strong><p>${x.moderation === "pending" ? "Seu relato está na fila de análise. Ele ainda não aparece no mapa público." : esc(x.reason) || "A análise foi concluída."}</p>${x.moderation === "approved" ? `<small>Atendimento: ${statuses[x.status]}</small>` : ""}</div></article>`,
        )
        .join("")
    : `<div class="profile-empty"><h3>Seu primeiro relato começa aqui</h3><p>Quando você registrar uma ocorrência conectado à sua conta, poderá acompanhar a análise neste espaço.</p><a class="btn btn-secondary" href="#registrar">Registrar minha primeira ocorrência</a></div>`;
}
function profileSection(account) {
  $("profileHistory").classList.toggle("hidden", account);
  $("profileAccount").classList.toggle("hidden", !account);
  for (const [id, on] of [
    ["historyTab", !account],
    ["accountTab", account],
  ]) {
    $(id).classList.toggle("active", on);
    $(id).setAttribute("aria-pressed", String(on));
  }
}
async function admin() {
  await profile();
  const allowed = user && ["admin", "manager"].includes(user.role);
  $("managementAccess").innerHTML = allowed
    ? `Acesso como ${user.role === "admin" ? "administrador" : "gestor"}.`
    : '<a href="#login">Entre com uma conta de gestor ou administrador.</a>';
  $("exportCsv").disabled = !allowed;
  $("adminTableBody").innerHTML = "";
  $("userManagement").innerHTML = "";
  if (!allowed) return;
  adminItems = await api("/admin/occurrences");
  adminTable();
  if (user.role === "admin") await renderUsers();
}
function adminTable() {
  const q = $("adminSearch").value.toLowerCase();
  $("adminTableBody").innerHTML = adminItems
    .filter((x) => (x.title + " " + x.neighborhood).toLowerCase().includes(q))
    .map(
      (x, i) =>
        `<tr><td>${i + 1}</td><td><a href="#detalhe-${x.id}">${esc(x.title)}</a></td><td>${esc(x.neighborhood)}</td><td>${x.type === "alagamento" ? "Alagamento" : "Resíduos"}</td><td>${badge(x)}</td><td>${decisions[x.moderation]}<br>${statuses[x.status]}<br>${esc(x.reason)}</td><td>${user.role === "admin" ? `<button data-action="approve" data-id="${x.id}">Aprovar</button><button data-action="reject" data-id="${x.id}">Rejeitar</button><button data-action="edit" data-id="${x.id}">Editar</button><button data-action="delete" data-id="${x.id}">Excluir</button>` : "Consulta"}</td></tr>`,
    )
    .join("");
  for (const [id, fn] of [
    ["adminPriority", (x) => x.criticality === "alto"],
    ["adminAnalysis", (x) => x.moderation === "pending"],
    ["adminService", (x) => x.status === "em_atendimento"],
    ["adminResolved", (x) => x.status === "resolvido"],
  ])
    $(id).textContent = adminItems.filter(fn).length;
}
async function renderUsers() {
  const users = await api("/users");
  $("userManagement").innerHTML =
    `<details class="panel"><summary>Gerenciar usuários e auditoria</summary><form id="newUser"><div class="form-grid"><div class="form-group"><label for="newName">Nome</label><input id="newName" required /></div><div class="form-group"><label for="newEmail">E-mail</label><input id="newEmail" type="email" required /></div><div class="form-group"><label for="newPassword">Senha inicial</label><input id="newPassword" type="password" minlength="10" required /></div><div class="form-group"><label for="newRole">Perfil</label><select id="newRole"><option value="manager">Gestor</option><option value="admin">Administrador</option><option value="citizen">Cidadão</option></select></div></div><button class="btn btn-primary">Criar usuário</button></form><div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><select id="role-${u.id}" aria-label="Perfil de ${esc(u.name)}">${["citizen", "manager", "admin"].map((r) => `<option ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}</select></td><td><select id="active-${u.id}" aria-label="Situação de ${esc(u.name)}"><option value="1" ${u.active ? "selected" : ""}>Ativo</option><option value="0" ${!u.active ? "selected" : ""}>Desativado</option></select></td><td><button data-user="${u.id}" ${u.id === user.id ? "disabled" : ""}>Salvar</button></td></tr>`).join("")}</tbody></table></div><button id="showAudit" class="btn btn-secondary">Consultar auditoria</button><pre id="auditOutput"></pre></details>`;
  $("newUser").onsubmit = safe(async (e) => {
    e.preventDefault();
    await api("/users", "POST", {
      name: $("newName").value,
      email: $("newEmail").value,
      password: $("newPassword").value,
      role: $("newRole").value,
    });
    await renderUsers();
    toast("Usuário criado.");
  });
  $("showAudit").onclick = safe(async () => {
    $("auditOutput").textContent = JSON.stringify(await api("/audit"), null, 2);
  });
}
async function route() {
  let r = location.hash.slice(1) || "home";
  if (r.startsWith("detalhe-")) {
    detailId = r.slice(8);
    r = "detalhe";
  }
  if (!$("page-" + r)) r = "home";
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.toggle("active-page", p.id === "page-" + r));
  document.querySelectorAll("[data-route]").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === r);
    if (a.dataset.route === r) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("mainNav").classList.remove("open");
  $("menuToggle").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "instant" });
  $("main-content").focus({ preventScroll: true });
  if (r === "mapa") initMap();
  if (r === "registrar") initPicker();
  if (r === "perfil") await profile();
  if (r === "gestao") await admin();
  if (r === "detalhe") {
    const x = await api("/occurrences/" + encodeURIComponent(detailId));
    $("occurrenceDetail").innerHTML =
      `<h2>${esc(x.title)}</h2>${badge(x)}<p>${esc(x.neighborhood)} · ${formatDate(x.date)} · ${x.type === "alagamento" ? "Alagamento" : "Resíduos"}</p><p>${esc(x.description)}</p>${photoMarkup(x)}<p>Localização: latitude ${x.lat}, longitude ${x.lng}.</p><p>${x.recurring ? "Há alagamentos registrados em dias diferentes nesta área." : "Ainda não há repetição de alagamentos em dias diferentes nesta área."}</p><p>${statuses[x.status]}</p>`;
  }
}
document.addEventListener(
  "DOMContentLoaded",
  safe(async () => {
    $("map").insertAdjacentHTML(
      "afterend",
      '<div id="mapResults" class="result-cards" aria-live="polite"></div>',
    );
    $("eventDate").value = civilDate();
    $("eventDate").max = $("eventDate").value;
    $("menuToggle").onclick = () => {
      $("menuToggle").setAttribute(
        "aria-expanded",
        String($("mainNav").classList.toggle("open")),
      );
    };
    window.addEventListener("hashchange", safe(route));
    $("applyFilters").onclick = safe(filters);
    $("clearFilters").onclick = safe(async () => {
      [
        "filterNeighborhood",
        "filterType",
        "filterCriticality",
        "filterPeriod",
      ].forEach((id) => ($(id).value = ""));
      await filters();
    });
    $("retryMap").onclick = () => {
      $("mapError").classList.add("hidden");
      initMap();
    };
    $("adminSearch").oninput = adminTable;
    $("geoButton").onclick = () => {
      if (!navigator.geolocation)
        return toast("Geolocalização indisponível. Preencha as coordenadas.");
      navigator.geolocation.getCurrentPosition(
        (p) => setPoint(p.coords.latitude, p.coords.longitude),
        () =>
          toast(
            "Não foi possível obter a localização. Preencha as coordenadas.",
          ),
        { timeout: 8000 },
      );
    };
    $("occurrenceDescription").oninput = () =>
      ($("descriptionCount").textContent = $(
        "occurrenceDescription",
      ).value.length);
    $("occurrenceForm").onsubmit = safe(async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      btn.disabled = true;
      try {
        await photoReady;
        if ($("occurrencePhoto").files.length && !selectedPhoto)
          throw Error(
            "Remova a imagem inválida ou escolha outra foto antes de enviar.",
          );
        const b = await api("/occurrences", "POST", {
          title: $("locationText").value,
          neighborhood: $("occurrenceNeighborhood").value,
          type: $("occurrenceType").value,
          description: $("occurrenceDescription").value,
          lat: Number($("latitude").value),
          lng: Number($("longitude").value),
          date: $("eventDate").value,
          contact: $("contact").value,
          image: selectedPhoto,
        });
        $("occurrenceForm").reset();
        $("eventDate").value = civilDate();
        $("successMessage").classList.remove("hidden");
        $("submissionMessage").textContent = user
          ? "Recebemos seu relato. Você pode acompanhar a análise no seu perfil."
          : "Recebemos seu relato anônimo para análise. Guarde o protocolo: " +
            b.id;
        $("submissionProfileLink").classList.toggle("hidden", !user);
        toast("Ocorrência enviada para análise.");
        await profile();
      } finally {
        btn.disabled = false;
      }
    });
    $("authForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      btn.disabled = true;
      $("authMessage").textContent = "";
      try {
        await api("/auth/login", "POST", {
          email: $("authEmail").value.trim(),
          password: $("authPassword").value,
        });
        $("authPassword").value = "";
        await profile();
        profileSection(false);
        location.hash = "perfil";
        toast("Você entrou na sua conta.");
      } catch (error) {
        $("authMessage").textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    };
    $("registerForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      $("registerMessage").textContent = "";
      if ($("registerPassword").value !== $("registerConfirm").value) {
        $("registerMessage").textContent = "As senhas precisam ser iguais.";
        $("registerConfirm").focus();
        return;
      }
      btn.disabled = true;
      try {
        const email = $("registerEmail").value.trim(),
          password = $("registerPassword").value;
        await api("/auth/register", "POST", {
          name: $("registerName").value.trim(),
          email,
          password,
        });
        try {
          await api("/auth/login", "POST", { email, password });
          $("registerForm").reset();
          await profile();
          profileSection(false);
          location.hash = "perfil";
          toast("Sua conta foi criada. Bem-vindo ao AlagaManaus!");
        } catch {
          $("registerForm").reset();
          $("authEmail").value = email;
          location.hash = "login";
          $("authMessage").textContent =
            "Conta criada. Entre com seu e-mail e senha.";
        }
      } catch (error) {
        $("registerMessage").textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    };
    $("logout").onclick = safe(async () => {
      await api("/auth/logout", "POST");
      await profile();
      location.hash = "login";
      toast("Você saiu da conta.");
    });
    $("historyTab").onclick = () => profileSection(false);
    $("accountTab").onclick = () => profileSection(true);
    $("profileEditForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      btn.disabled = true;
      $("profileEditMessage").textContent = "";
      try {
        await api("/auth/profile", "PATCH", {
          name: $("profileNameInput").value,
          email: $("profileEmailInput").value,
          currentPassword: $("profileCurrentPassword").value,
          newPassword: $("profileNewPassword").value,
        });
        $("profileCurrentPassword").value = "";
        $("profileNewPassword").value = "";
        await profile();
        $("profileEditMessage").textContent = "Dados atualizados com sucesso.";
      } catch (error) {
        $("profileEditMessage").textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    };
    document.querySelectorAll("[data-toggle-password]").forEach(
      (btn) =>
        (btn.onclick = () => {
          const field = $(btn.dataset.togglePassword);
          const show = field.type === "password";
          field.type = show ? "text" : "password";
          btn.textContent = show ? "Ocultar" : "Mostrar";
          btn.setAttribute(
            "aria-label",
            show ? "Ocultar senha" : "Mostrar senha",
          );
        }),
    );
    $("occurrencePhoto").onchange = () => {
      photoReady = selectPhoto();
    };
    $("removePhoto").onclick = clearPhoto;
    $("occurrenceForm").addEventListener("reset", () => {
      clearPhoto();
      $("descriptionCount").textContent = "0";
      $("successMessage").classList.add("hidden");
      if (picker && point) {
        picker.removeLayer(point);
        point = null;
      }
    });
    $("exportCsv").onclick = () => {
      location.href = "/api/reports?" + queryFilters() + "&format=csv";
    };
    $("adminTableBody").onclick = safe(async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id,
        action = btn.dataset.action;
      const x = adminItems.find((x) => x.id === id);
      if (action === "delete") {
        if (
          !confirm(
            "Excluir esta ocorrência? A ação será registrada na auditoria.",
          )
        )
          return;
        await api("/occurrences/" + id, "DELETE");
      } else if (action === "edit") {
        openEditor(x);
        return;
      } else {
        const reason = prompt(
          "Justificativa da decisão (mínimo 3 caracteres):",
        );
        if (reason === null) return;
        await api("/occurrences/" + id + "/moderate", "POST", {
          moderation: action === "approve" ? "approved" : "rejected",
          reason,
        });
      }
      await refresh();
      await admin();
      toast("Alteração salva.");
    });
    $("userManagement").addEventListener(
      "click",
      safe(async (e) => {
        const b = e.target.closest("[data-user]");
        if (!b) return;
        await api("/users/" + b.dataset.user, "PATCH", {
          role: $("role-" + b.dataset.user).value,
          active: Number($("active-" + b.dataset.user).value),
        });
        await renderUsers();
        toast("Usuário atualizado.");
      }),
    );
    await profile();
    await refresh();
    await route();
  }),
);
function openEditor(x) {
  let d = $("editDialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "editDialog";
    document.body.appendChild(d);
  }
  d.innerHTML = `<form id="editForm"><h2>Editar ocorrência</h2><p>A edição devolve o registro à moderação.</p>${[
    ["title", "Local"],
    ["neighborhood", "Bairro"],
    ["description", "Descrição"],
    ["date", "Data"],
    ["lat", "Latitude"],
    ["lng", "Longitude"],
  ]
    .map(
      ([k, l]) =>
        `<label for="edit-${k}">${l}</label><input id="edit-${k}" value="${esc(x[k])}" type="${["lat", "lng"].includes(k) ? "number" : k === "date" ? "date" : "text"}" step="any" required />`,
    )
    .join(
      "",
    )}<label for="edit-type">Tipo</label><select id="edit-type"><option value="alagamento" ${x.type === "alagamento" ? "selected" : ""}>Alagamento</option><option value="residuo" ${x.type === "residuo" ? "selected" : ""}>Resíduos</option></select><label for="edit-status">Atendimento</label><select id="edit-status">${Object.entries(
    statuses,
  )
    .map(
      ([k, l]) =>
        `<option value="${k}" ${x.status === k ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select><div class="form-actions"><button type="submit" class="btn btn-primary">Salvar</button><button id="cancelEdit" type="button" class="btn btn-ghost">Cancelar</button></div></form>`;
  d.showModal();
  $("cancelEdit").onclick = () => d.close();
  $("editForm").onsubmit = safe(async (e) => {
    e.preventDefault();
    const b = {};
    for (const k of [
      "title",
      "neighborhood",
      "description",
      "date",
      "lat",
      "lng",
      "type",
      "status",
    ])
      b[k] = ["lat", "lng"].includes(k)
        ? Number($("edit-" + k).value)
        : $("edit-" + k).value;
    await api("/occurrences/" + x.id, "PATCH", b);
    d.close();
    await refresh();
    await admin();
    toast("Registro editado e enviado novamente à moderação.");
  });
}

function clearPhoto() {
  selectedPhoto = null;
  $("occurrencePhoto").value = "";
  $("photoPreviewImage").removeAttribute("src");
  $("photoPreview").classList.add("hidden");
  $("photoFeedback").textContent = "";
}
async function selectPhoto() {
  const file = $("occurrencePhoto").files[0];
  selectedPhoto = null;
  $("photoPreview").classList.add("hidden");
  $("photoFeedback").textContent = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    $("photoFeedback").textContent = "Escolha uma foto JPG, PNG ou WebP.";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    $("photoFeedback").textContent = "A foto precisa ter no máximo 5 MB.";
    return;
  }
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if ($("occurrencePhoto").files[0] !== file) return;
    selectedPhoto = data;
    $("photoPreviewImage").src = data;
    $("photoPreview").classList.remove("hidden");
    $("photoFeedback").textContent =
      "Foto pronta para ser enviada. Ela será publicada somente após aprovação.";
  } catch {
    $("photoFeedback").textContent =
      "Não conseguimos ler essa foto. Selecione outra.";
  }
}
