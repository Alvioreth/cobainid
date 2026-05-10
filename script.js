const CONFIG = window.COBAIN_CONFIG || {};
const APPS_SCRIPT_URL = (CONFIG.APPS_SCRIPT_URL || "").trim();
const HOST_CODE_FALLBACK = CONFIG.HOST_CODE || "COBAINHOST";

const STORAGE_KEY = "cobain_students_static_demo_v1";
const HOST_SESSION_KEY = "cobain_host_session_static_v1";
const HOST_CODE_SESSION_KEY = "cobain_host_code_static_v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const page = document.body?.dataset.page || "home";
const toast = $("#toast");

function appsScriptReady() {
  return Boolean(APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes("TEMPEL_URL_WEB_APP"));
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3300);
}

function sanitize(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return sanitize(isoString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function makeId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `COBAIN-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStudent(student, index = 0) {
  return {
    id: student.id || `${Date.now()}-${index}`,
    createdAt: student.createdAt || student.timestamp || new Date().toISOString(),
    name: student.name || "",
    email: student.email || "",
    phone: student.phone || "",
    school: student.school || "",
    grade: student.grade || "",
    campus: student.campus || "",
    program: student.program || "",
    note: student.note || "",
    paymentProofName: student.paymentProofName || student.proofFileName || "",
    paymentProofUrl: student.paymentProofUrl || student.proofFileUrl || "",
    paymentProofFileId: student.paymentProofFileId || student.proofFileId || "",
    followShareProofName: student.followShareProofName || "",
    followShareProofUrl: student.followShareProofUrl || "",
    followShareProofFileId: student.followShareProofFileId || "",
  };
}

function readLocalStudents() {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(normalizeStudent);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function writeLocalStudents(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students.map(normalizeStudent)));
}

function postToAppsScript(payload) {
  if (!appsScriptReady()) {
    return Promise.reject(new Error("URL Google Apps Script belum diatur di config.js."));
  }

  const body = new FormData();
  Object.entries(payload).forEach(([key, value]) => body.append(key, value ?? ""));

  return fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    body,
  });
}

function getStudentsJsonp(hostCode) {
  if (!appsScriptReady()) {
    return Promise.resolve({
      ok: true,
      source: "local-demo",
      students: readLocalStudents(),
      message: "Mode demo lokal karena URL Apps Script belum diatur.",
    });
  }

  return new Promise((resolve, reject) => {
    const callbackName = `cobainJsonp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Koneksi ke Google Apps Script timeout. Cek URL Web App dan permission deploy."));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    const params = new URLSearchParams({
      action: "list",
      hostCode,
      callback: callbackName,
      cache: String(Date.now()),
    });

    script.onerror = () => {
      cleanup();
      reject(new Error("Gagal memuat data. Pastikan URL Apps Script sudah benar."));
    };

    script.src = `${APPS_SCRIPT_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

function fileToDataUrl(file, label = "file") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`${label} gagal dibaca. Coba pilih file lain.`));
    reader.readAsDataURL(file);
  });
}

function validateProofFile(file, label) {
  if (!file) {
    throw new Error(`${label} wajib diupload.`);
  }

  const maxSize = 3 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`Ukuran ${label.toLowerCase()} maksimal 3 MB. Kompres file dulu, lalu upload ulang.`);
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (file.type && !allowedTypes.includes(file.type)) {
    throw new Error(`Format ${label.toLowerCase()} harus JPG, PNG, WEBP, atau PDF.`);
  }
}

async function collectFormData() {
  const proofInput = $("#paymentProof");
  const followInput = $("#followShareProof");
  const proofFile = proofInput?.files?.[0] || null;
  const followFile = followInput?.files?.[0] || null;

  validateProofFile(proofFile, "Bukti pembayaran");
  validateProofFile(followFile, "Bukti follow dan share");

  const proofDataUrl = await fileToDataUrl(proofFile, "Bukti pembayaran");
  const followDataUrl = await fileToDataUrl(followFile, "Bukti follow dan share");

  return {
    ...normalizeStudent({
    id: makeId(),
    createdAt: new Date().toISOString(),
    name: $("#studentName").value.trim(),
    email: $("#studentEmail").value.trim().toLowerCase(),
    phone: $("#studentPhone").value.trim(),
    school: $("#studentSchool").value.trim(),
    grade: $("#studentGrade").value,
    campus: $("#studentCampus").value.trim(),
    program: $("#studentProgram").value,
    note: $("#studentNote").value.trim(),
    paymentProofName: proofFile.name || "bukti-pembayaran",
    followShareProofName: followFile.name || "bukti-follow-share",
  }),
    paymentProofBase64: proofDataUrl,
    paymentProofType: proofFile.type || "application/octet-stream",
    followShareProofBase64: followDataUrl,
    followShareProofType: followFile.type || "application/octet-stream",
  };
}

function openSuccessModal() {
  const modal = $("#successModal");
  if (!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeSuccessModal() {
  const modal = $("#successModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

async function submitRegistration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  let data;

  try {
    button.disabled = true;
    button.textContent = "Membaca bukti pembayaran dan follow/share...";
    data = await collectFormData();

    button.textContent = "Mengirim data...";

    if (appsScriptReady()) {
      await postToAppsScript({ action: "create", ...data });
      showToast("Pendaftaran berhasil dikirim ke host.");
    } else {
      const students = readLocalStudents();
      students.push(data);
      writeLocalStudents(students);
      showToast("Mode demo: data tersimpan lokal. Atur config.js agar masuk Google Sheets.");
    }

    form.reset();
    openSuccessModal();
  } catch (error) {
    showToast(error.message || "Data gagal dikirim. Coba lagi.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function chooseProgram(event) {
  const program = event.currentTarget.dataset.program;
  const select = $("#studentProgram");
  if (select) select.value = program;
  $("#daftar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast(`Paket dipilih: ${program}`);
}

function setHostLoggedIn(value, hostCode = "") {
  if (value) {
    sessionStorage.setItem(HOST_SESSION_KEY, "true");
    sessionStorage.setItem(HOST_CODE_SESSION_KEY, hostCode);
  } else {
    sessionStorage.removeItem(HOST_SESSION_KEY);
    sessionStorage.removeItem(HOST_CODE_SESSION_KEY);
  }
}

function isHostLoggedIn() {
  return sessionStorage.getItem(HOST_SESSION_KEY) === "true";
}

function getHostCode() {
  return sessionStorage.getItem(HOST_CODE_SESSION_KEY) || "";
}

function setSyncStatus(message, status = "info") {
  const el = $("#syncStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `sync-status ${status}`;
}

function countProgram(students, keyword) {
  return students.filter((student) => student.program.toLowerCase().includes(keyword)).length;
}

function updateStats(students) {
  const total = $("#totalStudents");
  const regular = $("#regularCount");
  const premium = $("#premiumCount");
  const mandiri = $("#mandiriCount");
  if (total) total.textContent = students.length;
  if (regular) regular.textContent = countProgram(students, "reguler");
  if (premium) premium.textContent = countProgram(students, "premium");
  if (mandiri) mandiri.textContent = students.filter((student) => /mandiri|iup/i.test(student.program)).length;
}

function renderRows(students) {
  const tableBody = $("#studentTableBody");
  const query = ($("#searchInput")?.value || "").trim().toLowerCase();
  if (!tableBody) return;

  const filtered = students.filter((student) => [
    student.name,
    student.email,
    student.phone,
    student.school,
    student.grade,
    student.campus,
    student.program,
    student.note,
    student.paymentProofName,
    student.paymentProofUrl,
    student.followShareProofName,
    student.followShareProofUrl,
  ].join(" ").toLowerCase().includes(query));

  updateStats(students);

  if (!filtered.length) {
    tableBody.innerHTML = `<tr><td colspan="12" class="empty-state">${query ? "Data tidak ditemukan." : "Belum ada data peserta."}</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map((student, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${sanitize(student.name)}</strong>${student.note ? `<br><small>${sanitize(student.note)}</small>` : ""}</td>
      <td>${sanitize(student.email)}</td>
      <td>${sanitize(student.phone)}</td>
      <td>${sanitize(student.school)}</td>
      <td>${sanitize(student.grade)}</td>
      <td>${sanitize(student.campus)}</td>
      <td>${sanitize(student.program)}</td>
      <td>${student.paymentProofUrl ? `<a href="${sanitize(student.paymentProofUrl)}" target="_blank" rel="noopener">Bukti bayar</a>` : "-"}</td>
      <td>${student.followShareProofUrl ? `<a href="${sanitize(student.followShareProofUrl)}" target="_blank" rel="noopener">Bukti follow/share</a>` : "-"}</td>
      <td>${formatDate(student.createdAt)}</td>
      <td><button class="action-btn" type="button" data-delete-id="${sanitize(student.id)}">Hapus</button></td>
    </tr>
  `).join("");
}

async function getStudentsForHost(hostCode) {
  const payload = await getStudentsJsonp(hostCode);
  if (!payload.ok) throw new Error(payload.error || "Gagal membaca data peserta.");
  return (payload.students || []).map(normalizeStudent);
}

async function renderHostTable() {
  if (!isHostLoggedIn()) return;
  const tableBody = $("#studentTableBody");
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="12" class="empty-state">Memuat data peserta...</td></tr>`;

  try {
    const students = await getStudentsForHost(getHostCode());
    window.__cobainStudents = students;
    renderRows(students);
    setSyncStatus(appsScriptReady()
      ? "Tersinkron dengan Google Sheets melalui Google Apps Script."
      : "Mode demo lokal. Edit config.js agar data peserta online masuk ke Google Sheets.", appsScriptReady() ? "ok" : "warn");
  } catch (error) {
    window.__cobainStudents = [];
    renderRows([]);
    setSyncStatus(error.message || "Gagal memuat data.", "error");
    showToast(error.message || "Gagal memuat data.");
  }
}

function unlockDashboard() {
  $("#dashboard")?.classList.remove("locked");
  const loginCard = $("#hostLoginCard");
  if (loginCard) loginCard.hidden = true;
  const logoutBtn = $("#hostLogoutBtn");
  if (logoutBtn) logoutBtn.hidden = false;
  renderHostTable();
}

function lockDashboard() {
  $("#dashboard")?.classList.add("locked");
  const loginCard = $("#hostLoginCard");
  if (loginCard) loginCard.hidden = false;
  const logoutBtn = $("#hostLogoutBtn");
  if (logoutBtn) logoutBtn.hidden = true;
  setSyncStatus("Login host terlebih dahulu.", "info");
}

async function submitHostLogin(event) {
  event.preventDefault();
  const code = $("#hostPassword").value.trim();
  if (!code) return;

  const button = event.currentTarget.querySelector('button[type="submit"]');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = "Memeriksa akses...";

    if (appsScriptReady()) {
      const payload = await getStudentsJsonp(code);
      if (!payload.ok) throw new Error(payload.error || "Kode host salah.");
    } else if (code !== HOST_CODE_FALLBACK) {
      throw new Error("Kode host salah.");
    }

    setHostLoggedIn(true, code);
    unlockDashboard();
    showToast("Dashboard host terbuka.");
    $("#dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showToast(error.message || "Login host gagal.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function logoutHost() {
  setHostLoggedIn(false);
  lockDashboard();
  showToast("Host berhasil logout.");
}

function exportCsv() {
  const students = window.__cobainStudents || [];
  if (!students.length) {
    showToast("Belum ada data untuk diekspor.");
    return;
  }

  const headers = ["No", "Nama", "Email", "WhatsApp", "Sekolah", "Kelas", "Target PTN/Jurusan", "Paket", "Catatan", "Nama Bukti Pembayaran", "Link Bukti Pembayaran", "Nama Bukti Follow & Share", "Link Bukti Follow & Share", "Tanggal Daftar"];
  const rows = students.map((student, index) => [
    index + 1,
    student.name,
    student.email,
    student.phone,
    student.school,
    student.grade,
    student.campus,
    student.program,
    student.note,
    student.paymentProofName,
    student.paymentProofUrl,
    student.followShareProofName,
    student.followShareProofUrl,
    formatDate(student.createdAt),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pendaftaran-cobain-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV berhasil dibuat.");
}

async function deleteStudent(id) {
  if (!confirm("Hapus data peserta ini?")) return;

  if (!appsScriptReady()) {
    writeLocalStudents(readLocalStudents().filter((student) => student.id !== id));
    await renderHostTable();
    showToast("Data demo lokal dihapus.");
    return;
  }

  try {
    await postToAppsScript({ action: "delete", hostCode: getHostCode(), id });
    setTimeout(renderHostTable, 900);
    showToast("Permintaan hapus dikirim ke Google Sheets.");
  } catch (error) {
    showToast(error.message || "Gagal menghapus data.");
  }
}

async function clearStudents() {
  if (!confirm("Hapus semua data pendaftaran?")) return;

  if (!appsScriptReady()) {
    localStorage.removeItem(STORAGE_KEY);
    await renderHostTable();
    showToast("Semua data demo lokal dihapus.");
    return;
  }

  try {
    await postToAppsScript({ action: "clear", hostCode: getHostCode() });
    setTimeout(renderHostTable, 900);
    showToast("Permintaan hapus semua dikirim ke Google Sheets.");
  } catch (error) {
    showToast(error.message || "Gagal menghapus semua data.");
  }
}

function setupNavigation() {
  const navToggle = $("#navToggle");
  const mainNav = $("#mainNav");
  if (!navToggle || !mainNav) return;
  navToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  mainNav.addEventListener("click", (event) => {
    if (event.target.matches("a")) mainNav.classList.remove("open");
  });
}

function setupRevealAnimation() {
  const elements = $$(".reveal");
  if (!elements.length || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  elements.forEach((element) => observer.observe(element));
}

function setupPage() {
  setupNavigation();
  setupRevealAnimation();

  if (page === "peserta") {
    $("#studentForm")?.addEventListener("submit", submitRegistration);
    $$(".choose-program").forEach((button) => button.addEventListener("click", chooseProgram));
    $("#modalClose")?.addEventListener("click", closeSuccessModal);
    $("#modalOk")?.addEventListener("click", closeSuccessModal);
    $("#successModal")?.addEventListener("click", (event) => {
      if (event.target.id === "successModal") closeSuccessModal();
    });
  }

  if (page === "host") {
    $("#hostLoginForm")?.addEventListener("submit", submitHostLogin);
    $("#hostLogoutBtn")?.addEventListener("click", logoutHost);
    $("#searchInput")?.addEventListener("input", () => renderRows(window.__cobainStudents || []));
    $("#refreshBtn")?.addEventListener("click", renderHostTable);
    $("#exportBtn")?.addEventListener("click", exportCsv);
    $("#clearBtn")?.addEventListener("click", clearStudents);
    $("#studentTableBody")?.addEventListener("click", (event) => {
      const id = event.target?.dataset?.deleteId;
      if (id) deleteStudent(id);
    });

    if (isHostLoggedIn()) unlockDashboard();
    else lockDashboard();
  }
}

window.addEventListener("storage", () => {
  if (page === "host" && isHostLoggedIn()) renderHostTable();
});

setupPage();
