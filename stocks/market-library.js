const config = JSON.parse(document.getElementById("marketConfig")?.textContent || "{}");
const docsEl = document.getElementById("docs");
const searchEl = document.getElementById("search");
const sortSelectEl = document.getElementById("sortSelect");
const resultCountEl = document.getElementById("resultCount");
const emptyStateEl = document.getElementById("emptyState");
const totalStatEl = document.getElementById("totalStat");
const latestStatEl = document.getElementById("latestStat");
const sourceStatEl = document.getElementById("sourceStat");
const retryBtn = document.getElementById("retryBtn");

let documents = [];
let listSource = "Auto";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function titleFromFilename(filename) {
  return filename
    .replace(/\.html$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, char => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "ไม่ทราบวันที่";
  return new Intl.DateTimeFormat("th-TH", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function readingMinutes(size) {
  return Math.max(3, Math.round((size || 30000) / 8500));
}

async function json(url, github = false) {
  const options = github ? { headers: { Accept: "application/vnd.github+json" } } : undefined;
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Fetch ${response.status}`);
  return response.json();
}

async function text(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Fetch ${response.status}`);
  return response.text();
}

function loadEmbeddedFileList() {
  try {
    const files = JSON.parse(document.getElementById("folderFiles")?.textContent || "[]");
    return Array.isArray(files) ? files : [];
  } catch (error) {
    return [];
  }
}

function loadFallbackFileList() {
  return Array.isArray(config.fallbackFiles) ? config.fallbackFiles : [];
}

function isLocalPreview() {
  return ["", "localhost", "127.0.0.1"].includes(location.hostname);
}

async function loadManifestFileList() {
  const manifestPath = config.manifestPath || "../stock-manifest.json";
  try {
    const manifest = await json(manifestPath);
    const files = manifest?.[config.folder];
    return Array.isArray(files) ? files.map(file => ({ ...file, source: file.source || "manifest" })) : [];
  } catch (error) {
    return [];
  }
}

async function loadRemoteFileList() {
  const apiBase = `https://api.github.com/repos/${config.owner}/${config.repo}`;
  try {
    const files = await json(`${apiBase}/contents/${config.folder}`, true);
    listSource = "GitHub";
    return files
      .filter(file => file.type === "file")
      .map(file => ({ name: file.name, size: file.size || 0, source: "github" }));
  } catch (error) {
    const payload = await json(`https://data.jsdelivr.com/v1/package/gh/${config.owner}/${config.repo}@${config.branch}/flat`);
    const prefix = `/${config.folder}/`;
    listSource = "jsDelivr";
    return (payload.files || [])
      .filter(file => file.name.startsWith(prefix) && !file.name.slice(prefix.length).includes("/"))
      .map(file => ({ name: file.name.slice(prefix.length), size: file.size || 0, source: "jsdelivr" }));
  }
}

async function loadFileList() {
  const embeddedFiles = loadEmbeddedFileList();
  if (embeddedFiles.length) {
    listSource = "GitHub Pages";
    return embeddedFiles;
  }

  const fallbackFiles = loadFallbackFileList();
  const manifestFiles = await loadManifestFileList();
  if (isLocalPreview() && manifestFiles.length) {
    listSource = "Manifest";
    return manifestFiles;
  }

  if (fallbackFiles.length && isLocalPreview()) {
    listSource = "Static";
    return fallbackFiles;
  }

  try {
    const remoteFiles = await loadRemoteFileList();
    if (remoteFiles.length) return remoteFiles;
  } catch (error) {
    if (!fallbackFiles.length && !manifestFiles.length) throw error;
  }

  if (manifestFiles.length) {
    listSource = "Manifest";
    return manifestFiles;
  }

  if (fallbackFiles.length) {
    listSource = "Static";
    return fallbackFiles;
  }

  return [];
}

async function latestCommitDate(file) {
  if (file.source !== "github" && file.source !== "jekyll") return "";
  try {
    const path = `${config.folder}/${file.name}`;
    const apiBase = `https://api.github.com/repos/${config.owner}/${config.repo}`;
    const commits = await json(`${apiBase}/commits?path=${encodeURIComponent(path)}&per_page=1`, true);
    return commits[0]?.commit?.committer?.date?.slice(0, 10) || "";
  } catch (error) {
    return "";
  }
}

async function metadata(file) {
  let title = titleFromFilename(file.name);
  let description = `เอกสาร HTML: ${title}`;
  try {
    const html = await text(`./${encodeURI(file.name)}`);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    if (titleMatch?.[1]) title = titleMatch[1].replace(/\s+/g, " ").trim();
    if (descMatch?.[1]) description = descMatch[1].replace(/\s+/g, " ").trim();
  } catch (error) {}
  return { ...file, title, description, date: await latestCommitDate(file) };
}

function sortDocs(items) {
  const sorted = [...items];
  if (sortSelectEl.value === "oldest") return sorted.sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.title.localeCompare(b.title, "th"));
  if (sortSelectEl.value === "title") return sorted.sort((a, b) => a.title.localeCompare(b.title, "th"));
  return sorted.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title, "th"));
}

function visibleDocs() {
  const keyword = searchEl.value.trim().toLowerCase();
  return sortDocs(documents.filter(doc => !keyword || `${doc.title} ${doc.name} ${doc.description}`.toLowerCase().includes(keyword)));
}

function render() {
  const items = visibleDocs();
  docsEl.innerHTML = items.map(doc => `
    <a class="card" href="${config.assetRoot}reader.html?doc=${encodeURIComponent(`${config.folder}/${doc.name}`)}">
      <div class="meta">
        <span class="pill primary">${escapeHtml(config.label)}</span>
        <span class="pill">${escapeHtml(formatDate(doc.date))}</span>
        <span class="pill">${readingMinutes(doc.size)} นาที</span>
      </div>
      <h3>${escapeHtml(doc.title)}</h3>
      <p>${escapeHtml(doc.description)}</p>
      <div class="footer-row"><span>${escapeHtml(doc.name)}</span><span class="open">เปิดอ่าน</span></div>
    </a>
  `).join("");
  resultCountEl.textContent = `${items.length} รายการ`;
  totalStatEl.textContent = documents.length;
  latestStatEl.textContent = documents.length ? "พร้อม" : "-";
  sourceStatEl.textContent = listSource;
  emptyStateEl.style.display = items.length ? "none" : "block";
}

async function load() {
  docsEl.innerHTML = `<article class="card"><span class="pill primary">Loading</span><h3>กำลังโหลดเอกสารใน ${config.folder}/</h3><p>ระบบกำลังอ่านไฟล์ HTML ในโฟลเดอร์นี้อัตโนมัติ</p></article>`;
  emptyStateEl.style.display = "none";
  try {
    const files = (await loadFileList()).filter(file => file.name.toLowerCase().endsWith(".html") && file.name.toLowerCase() !== "index.html" && !file.name.toLowerCase().includes("temp"));
    documents = (await Promise.all(files.map(metadata))).sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title, "th"));
    render();
  } catch (error) {
    documents = [];
    docsEl.innerHTML = "";
    emptyStateEl.textContent = "โหลดเอกสารไม่สำเร็จ ตรวจสอบว่าโฟลเดอร์นี้ถูก push ขึ้น GitHub แล้ว และลอง refresh อีกครั้ง";
    emptyStateEl.style.display = "block";
    render();
  }
}

searchEl.addEventListener("input", render);
sortSelectEl.addEventListener("change", render);
retryBtn.addEventListener("click", load);
load();
