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
function occurrencePreview(x, context = "admin") {
  const image = x.imageUrl ? `<button type="button" class="occurrence-thumb" data-preview="${esc(x.id)}" aria-label="Ampliar foto de ${esc(x.title)}"><img src="${esc(x.imageUrl)}" alt="Foto da ocorrência em ${esc(x.title)}" loading="lazy" /><span>Ampliar foto ↗</span></button>` : '<span class="no-photo">Sem foto anexada</span>';
  return `<div class="occurrence-preview ${context === "map" ? "map-preview" : ""}">${image}<details class="description-preview"><summary>Descrição da ocorrência</summary><p>${esc(x.description)}</p></details><p class="description-excerpt">${esc(x.description.slice(0, 160))}${x.description.length > 160 ? "…" : ""}</p></div>`;
}
function handlePhotoPreview(e) {
  const button = e.target.closest("[data-preview]");
  if (!button) return;
  e.stopPropagation();
  const collection = location.hash === "#gestao" ? adminItems : items;
  openPhotoPreview(collection.find(x => x.id === button.dataset.preview));
}
function openPhotoPreview(x) {
  if (!x?.imageUrl) return;
  let dialog = $("photoDialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "photoDialog";
    dialog.className = "photo-dialog";
    dialog.setAttribute("aria-labelledby", "photoDialogTitle");
    document.body.appendChild(dialog);
  }
  dialog.innerHTML = `<form method="dialog" class="photo-dialog-heading"><h2 id="photoDialogTitle">${esc(x.title)}</h2><button class="btn btn-secondary" autofocus>Fechar</button></form><img src="${esc(x.imageUrl)}" alt="Foto anexada à ocorrência em ${esc(x.title)}" /><p>${esc(x.description)}</p>`;
  dialog.showModal();
}
function cards(rows) {
  return (
    rows
      .map(
        (x) =>
          `<article class="panel"><h3><a href="#detalhe-${x.id}">${esc(x.title)}</a></h3><p>${esc(x.neighborhood)} · ${formatDate(x.date)} · ${x.type === "alagamento" ? "Alagamento" : "Resíduos"}</p>${badge(x)}${occurrencePreview(x, "map")}<a href="#detalhe-${encodeURIComponent(x.id)}">Ver ocorrência completa ↗</a></article>`,
      )
      .join("") || "<p>Nenhuma ocorrência aprovada corresponde à consulta.</p>"
  );
}
function neighborhoodKey(name) {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}
function populateNeighborhoods() {
  const select = $("filterNeighborhood");
  const selected = select.value;
  const names = new Map(MANAUS_NEIGHBORHOODS.map(n => [neighborhoodKey(n.name), n.name]));
  items.forEach(x => {
    if (!names.has(neighborhoodKey(x.neighborhood))) names.set(neighborhoodKey(x.neighborhood), x.neighborhood);
  });
  select.replaceChildren(new Option("Todos os bairros", ""));
  [...names.values()].sort((a, b) => a.localeCompare(b, "pt-BR")).forEach(name => select.add(new Option(name, name)));
  select.value = selected;
}
function focusNeighborhood() {
  if (!map) return;
  const name = $("filterNeighborhood").value;
  if (!name) {
    map.setView([-3.0937, -60.0212], 12);
    return;
  }
  const neighborhood = MANAUS_NEIGHBORHOODS.find(n => neighborhoodKey(n.name) === neighborhoodKey(name));
  if (neighborhood) map.fitBounds(neighborhood.bounds, { padding: [24, 24], maxZoom: 15 });
  else {
    const points = items.filter(x => neighborhoodKey(x.neighborhood) === neighborhoodKey(name)).map(x => [x.lat, x.lng]);
    if (points.length) map.fitBounds(points, { padding: [24, 24], maxZoom: 15 });
  }
}
async function refresh() {
  const b = await api("/occurrences");
  items = b.items;
  areas = (await api("/areas")).items;
  populateNeighborhoods();
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
  updateAnalysisSummary();
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
  $("homePriorities").innerHTML = [...items]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 3)
    .map(x => `<a class="home-record" href="#detalhe-${encodeURIComponent(x.id)}"><span class="home-record-icon" aria-hidden="true">${x.type === "alagamento" ? "≈" : "◇"}</span><span><strong>${esc(x.title)}</strong><small>${esc(x.neighborhood)} · ${formatDate(x.date)}</small></span><span class="home-record-arrow" aria-hidden="true">↗</span></a>`).join("")
    || '<div class="home-empty"><span class="home-empty-icon" aria-hidden="true">⌖</span><div><strong>O próximo registro pode ser o seu.</strong><p>Os relatos aparecem aqui após a moderação.</p></div></div>';
  const homeBadge = document.querySelector(".priority-spotlight .badge");
  homeBadge.className = "badge " + (first?.criticality || "sem_dados");
  const homeScore = document.querySelector(".hero-score");
  homeScore.style.setProperty("--home-score", first?.score || 0);
  homeScore.style.setProperty("--home-color", color(first?.criticality || "sem_dados"));
  homeScore.setAttribute("aria-label", first ? `Índice ${first.score} de 100` : "Sem dados para calcular o índice");
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
  const selectedNeighborhood = $("filterNeighborhood").value;
  const query = new URLSearchParams(filterQuery);
  query.delete("neighborhood");
  const b = await api("/occurrences?" + query);
  if (selectedNeighborhood) b.items = b.items.filter(x => neighborhoodKey(x.neighborhood) === neighborhoodKey(selectedNeighborhood));
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
        `<div class="map-occurrence-popup"><strong>${esc(x.title)}</strong><p>${formatDate(x.date)} · ${esc(x.neighborhood)}</p>${badge(x)}${occurrencePreview(x, "map")}<a href="#detalhe-${encodeURIComponent(x.id)}">Ver ocorrência completa ↗</a></div>`,
        { maxWidth: 320 },
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
    map.on("popupopen", e => {
      const element = e.popup.getElement();
      element.removeEventListener("click", handlePhotoPreview);
      element.addEventListener("click", handlePhotoPreview);
    });
  }
  map.invalidateSize();
  $("mapLoading").classList.add("hidden");
  focusNeighborhood();
  safe(filters)();
}
function setPoint(lat, lng) {
  $("latitude").value = lat.toFixed(6);
  $("longitude").value = lng.toFixed(6);
  $("occurrenceForm").dispatchEvent(new Event("locationupdated"));
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
// Consultas explícitas: nenhum pedido é feito a cada tecla digitada.
let addressLookupVersion = 0;
async function lookupAddress(byPostalCode = false) {
  const version = ++addressLookupVersion;
  const current = () => version === addressLookupVersion;
  const status = $("addressStatus");
  const buttons = [$("postalSearch"), $("addressSearch")];
  const snapshot = () => ["postalCode", "locationText", "occurrenceNeighborhood", "latitude", "longitude"].map(id => $(id).value).join("|");
  let original = snapshot();
  const unchanged = () => current() && original === snapshot();
  buttons.forEach(button => button.disabled = true);
  status.textContent = "Buscando endereço…";
  try {
    if (byPostalCode) {
      const cep = $("postalCode").value.replace(/\D/g, "");
      if (cep.length !== 8) throw Error("Informe um CEP com 8 dígitos.");
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw Error("Consulta de CEP indisponível. Tente novamente ou preencha manualmente.");
      const data = await response.json();
      if (!unchanged()) return;
      if (data.erro) throw Error("CEP não encontrado. Confira os números ou preencha o endereço manualmente.");
      if (data.ibge !== "1302603") throw Error("Este CEP não pertence a Manaus. Informe um CEP da cidade.");
      if (data.logradouro) $("locationText").value = data.logradouro;
      if (data.bairro) $("occurrenceNeighborhood").value = data.bairro;
      ["locationText", "occurrenceNeighborhood"].forEach(id => $(id).dispatchEvent(new Event("input", {bubbles: true})));
      original = snapshot();
      if (!data.logradouro) throw Error("CEP geral encontrado. Complete a rua e o bairro e clique em Localizar endereço no mapa.");
      status.textContent = "Endereço preenchido. Buscando o ponto aproximado…";
    }
    const street = $("locationText").value.trim();
    const neighborhood = $("occurrenceNeighborhood").value.trim();
    if (!street || !neighborhood) throw Error("Preencha a rua e o bairro para localizar no mapa.");
    const params = new URLSearchParams({format: "jsonv2", q: `${street}, ${neighborhood}, Manaus, Amazonas, Brasil`, countrycodes: "br", limit: "1", viewbox: "-60.2,-2.8,-59.8,-3.3", bounded: "1"});
    const response = await fetch("https://nominatim.openstreetmap.org/search?" + params, {signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw Error("Busca no mapa indisponível. O endereço foi mantido; marque o ponto manualmente.");
    const results = await response.json();
    if (!unchanged()) return;
    const lat = Number(results[0]?.lat), lng = Number(results[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw Error("Endereço não localizado no mapa. Confira a rua e o bairro ou marque o ponto manualmente.");
    initPicker();
    setPoint(lat, lng);
    if (picker) picker.setView([lat, lng], 17);
    status.textContent = "Ponto aproximado encontrado. Confira o mapa e arraste o marcador até o local exato da ocorrência.";
  } catch (error) {
    if (unchanged()) status.textContent = error.name === "TimeoutError" || error.name === "TypeError"
      ? "Não foi possível concluir a consulta. Confira sua conexão ou preencha o endereço e marque o ponto manualmente."
      : error.message;
  } finally {
    if (current()) {
      if (original !== snapshot() && status.textContent.includes("Buscando")) status.textContent = "Os dados foram alterados. Faça uma nova busca para o endereço atual.";
      buttons.forEach(button => button.disabled = false);
    }
  }
}
// Resolve o endereço somente após o usuário solicitar sua localização.
async function useCurrentLocation() {
  if (!navigator.geolocation)
    return toast("Geolocalização indisponível. Preencha o endereço e as coordenadas.");
  const button = $("geoButton");
  if (button.disabled) return;
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Localizando…";
  let located = false;
  try {
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }),
    );
    const { latitude, longitude, accuracy } = position.coords;
    setPoint(latitude, longitude);
    located = true;
    if (picker) picker.setView([latitude, longitude], 17);
    const coordinates = [$("latitude").value, $("longitude").value];
    const streetField = $("locationText");
    const neighborhoodField = $("occurrenceNeighborhood");
    const previousStreet = streetField.value;
    const previousNeighborhood = neighborhoodField.value;
    button.textContent = "Buscando endereço…";
    const query = new URLSearchParams({
      format: "jsonv2", lat: String(latitude), lon: String(longitude),
      addressdetails: "1", zoom: "18", layer: "address", "accept-language": "pt-BR",
    });
    const response = await fetch("https://nominatim.openstreetmap.org/reverse?" + query, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("Endereço indisponível");
    const data = await response.json();
    if (data.error || !data.address) throw Error("Endereço não encontrado");
    // Não sobrescreve um ponto ou endereço que a pessoa alterou durante a consulta.
    if (coordinates[0] !== $("latitude").value || coordinates[1] !== $("longitude").value)
      return toast("O ponto foi alterado. Confira o endereço do local selecionado.");
    const address = data.address;
    const street = address.road || address.pedestrian || address.residential || address.footway || "";
    const neighborhood = address.suburb || address.quarter || address.neighbourhood || "";
    if (street && streetField.value === previousStreet) {
      streetField.value = street + (address.house_number ? ", " + address.house_number : "");
      streetField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (neighborhood && neighborhoodField.value === previousNeighborhood) {
      neighborhoodField.value = neighborhood;
      neighborhoodField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const precision = Number.isFinite(accuracy) ? ` Precisão estimada: ${Math.round(accuracy)} m.` : "";
    toast((street && neighborhood
      ? "Localização obtida. Confira a rua e o bairro antes de enviar."
      : "Localização obtida; endereço incompleto. Confira e complete rua e bairro.") + precision);
  } catch (error) {
    toast(located
      ? "Coordenadas obtidas, mas não foi possível consultar o endereço. Preencha rua e bairro."
      : error.code === 1
        ? "Permita o acesso à localização no navegador ou preencha os dados manualmente."
        : "Não foi possível obter a localização. Tente novamente ou preencha os dados manualmente.");
  } finally {
    button.disabled = false;
    button.textContent = label;
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
  $("managementContent").classList.toggle("hidden", !allowed);
  if (!allowed) return;
  await refresh();
  adminItems = await api("/admin/occurrences");
  adminTable();

}
function analysisWindow() {
  const now = new Date();
  return { end: civilDate(now), start: civilDate(new Date(now.getTime() - 89 * 86400000)) };
}
function inAnalysisPeriod(row) {
  const {start, end} = analysisWindow();
  return row.date >= start && row.date <= end;
}
function updateAnalysisSummary() {
  const included = items.filter(inAnalysisPeriod);
  $("analysisIncluded").textContent = included.length;
  $("analysisAreas").textContent = areas.length;
  $("analysisRecurring").textContent = areas.filter(a => a.recurring).length;
  $("analysisHistorical").textContent = items.length - included.length;
  const {start, end} = analysisWindow();
  $("analysisDateRange").textContent = `${formatDate(start)} a ${formatDate(end)}`;
}
function adminContribution(x) {
  if (x.moderation !== "approved") return '<span class="contribution muted">Não participa</span><small>Depende de aprovação</small>';
  if (!inAnalysisPeriod(x)) return '<span class="contribution historical">Registro histórico</span><small>Fora dos últimos 90 dias</small>';
  return `<span class="contribution included">Incluído no cálculo</span><small>Índice da área: ${x.score ?? "—"}/100</small>${badge(x)}`;
}
function adminTable() {
  const q = neighborhoodKey($("adminSearch").value);
  const moderation = $("adminModeration").value;
  const type = $("adminType").value;
  const rows = adminItems.filter(x => neighborhoodKey(`${x.title} ${x.neighborhood} ${x.description}`).includes(q)
      && (!moderation || x.moderation === moderation) && (!type || x.type === type))
    .sort((a,b) => Number(b.moderation === "pending") - Number(a.moderation === "pending"));
  $("adminResultCount").textContent = `${rows.length} de ${adminItems.length} relato(s)`;
  $("adminTableBody").innerHTML = rows.map(x => `<tr><td><span class="record-type">${x.type === "alagamento" ? "Alagamento" : "Resíduos"} · ${formatDate(x.date)}</span><a class="record-title" href="#detalhe-${encodeURIComponent(x.id)}">${esc(x.title)}</a><small>${esc(x.neighborhood)}${x.imageUrl ? " · Foto anexada" : ""}</small>${occurrencePreview(x)}</td><td><span class="decision-badge ${x.moderation}">${decisions[x.moderation]}</span><small>${x.moderation !== "approved" ? (x.moderation === "pending" ? "Aguardando decisão" : "Não publicado") : x.status === "em_analise" ? "Atendimento não iniciado" : statuses[x.status]}</small>${x.reason ? `<small class="decision-reason">${esc(x.reason)}</small>` : ""}</td><td>${adminContribution(x)}</td><td><div class="moderation-actions">${user.role === "admin" ? `${x.moderation !== "approved" ? `<button class="approve-action" data-action="approve" data-id="${x.id}">Aprovar</button>` : ""}${x.moderation !== "rejected" ? `<button data-action="reject" data-id="${x.id}">Rejeitar</button>` : ""}<button data-action="edit" data-id="${x.id}">Editar</button><button class="delete-action" data-action="delete" data-id="${x.id}">Excluir</button>` : '<span class="ops-footnote">Acesso de consulta</span>'}</div></td></tr>`).join("")
    || '<tr><td colspan="4"><div class="admin-empty"><strong>Nenhum relato encontrado.</strong><p>Altere os filtros ou registre uma ocorrência para iniciar a demonstração.</p></div></td></tr>';
  $("adminAnalysis").textContent = adminItems.filter(x => x.moderation === "pending").length;
  $("adminApproved").textContent = adminItems.filter(x => x.moderation === "approved" && inAnalysisPeriod(x)).length;
  $("adminPriority").textContent = areas.filter(a => a.criticality === "alto").length;
  $("adminResolved").textContent = adminItems.filter(x => x.moderation === "approved" && x.status === "resolvido").length;
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
  if (r === "criticidade") await refresh();
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
    populateNeighborhoods();
    $("filterNeighborhood").onchange = safe(async () => {
      focusNeighborhood();
      await filters();
    });
    $("applyFilters").onclick = safe(filters);
    $("clearFilters").onclick = safe(async () => {
      [
        "filterNeighborhood",
        "filterType",
        "filterCriticality",
        "filterPeriod",
      ].forEach((id) => ($(id).value = ""));
      focusNeighborhood();
      await filters();
    });
    $("retryMap").onclick = () => {
      $("mapError").classList.add("hidden");
      initMap();
    };
    $("adminSearch").oninput = adminTable;
    $("adminModeration").onchange = adminTable;
    $("adminType").onchange = adminTable;
    $("refreshAnalysis").onclick = safe(async () => {
      const button = $("refreshAnalysis");
      button.disabled = true;
      try { await refresh(); toast("Indicadores atualizados com os relatos aprovados."); }
      finally { button.disabled = false; }
    });
    $("geoButton").onclick = useCurrentLocation;
    $("postalSearch").onclick = () => lookupAddress(true);
    $("addressSearch").onclick = () => lookupAddress(false);
    $("postalCode").oninput = () => {
      const digits = $("postalCode").value.replace(/\D/g, "").slice(0, 8);
      $("postalCode").value = digits.replace(/^(\d{5})(\d)/, "$1-$2");
    };
    $("postalCode").onkeydown = e => {
      if (e.key === "Enter") { e.preventDefault(); lookupAddress(true); }
    };
    ["latitude", "longitude"].forEach(id => $(id).addEventListener("change", () => {
      const lat = Number($("latitude").value), lng = Number($("longitude").value);
      if ($("latitude").value && $("longitude").value && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) setPoint(lat, lng);
    }));
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
      addressLookupVersion++;
      ["postalSearch", "addressSearch"].forEach(id => $(id).disabled = false);
      $("addressStatus").textContent = "Não sabe o CEP? Preencha a rua e o bairro abaixo.";
      clearPhoto();
      $("descriptionCount").textContent = "0";
      $("successMessage").classList.add("hidden");
      if (picker && point) {
        picker.removeLayer(point);
        point = null;
      }
    });
    $("exportCsv").onclick = () => {
      location.href = "/api/reports?format=csv";
    };
    document.addEventListener("click", handlePhotoPreview);
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
        const reason = action === "approve"
          ? "Registro aprovado pela administração."
          : "Registro rejeitado pela administração.";
        await api("/occurrences/" + id + "/moderate", "POST", {
          moderation: action === "approve" ? "approved" : "rejected",
          reason,
        });
      }
      await admin();
      toast("Alteração salva. Os indicadores de criticidade foram atualizados.");
    });
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
