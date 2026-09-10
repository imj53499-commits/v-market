// Public Storefront Client Logic for V-MARKET

const STORAGE_KEY_PRODUCTS = "vm_products_db";
const STORAGE_KEY_USER = "vm_user_session";
const STORAGE_KEY_ORDERS = "vm_orders_db";
const STORAGE_KEY_DEPOSITS = "vm_deposits_db";
const WORKER_URL = "https://v-market.imj53499.workers.dev";

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    title: "스킨 0~10",
    description: "스킨 0~10개짜리 계정",
    skins: "0~10개 무작위",
    stock: 62,
    price: 10,
    server: "한국 (KR)",
    details: "기본 지급 스킨 및 배틀패스 스킨 무작위 포함. 계정 생성일 90일 이상, 본인 확인 완료 안전 계정입니다."
  },
  {
    id: 2,
    title: "스킨 11~20",
    description: "스킨 11~20개짜리 계정",
    skins: "11~20개 무작위",
    stock: 45,
    price: 50,
    server: "한국 (KR)",
    details: "인기 총기 스킨 2종 이상 확정 포함. 경쟁전 배치 즉시 플레이 가능, 이메일 변경 가능."
  },
  {
    id: 3,
    title: "스킨 21~30",
    description: "스킨 21~30개짜리 계정",
    skins: "21~30개 무작위",
    stock: 28,
    price: 100,
    server: "한국 (KR)",
    details: "프라임, 밴달, 팬텀 등 고급 무기 스킨 다수 보유. 칼 스킨 1개 이상 확정 포함."
  },
  {
    id: 4,
    title: "스킨 31~40",
    description: "스킨 31~40개짜리 계정",
    skins: "31~40개 무작위",
    stock: 14,
    price: 300,
    server: "한국 (KR)",
    details: "한정판 번들 및 칼/근접무기 복수 보유. 챔피언스/쿠로나미/오니 계열 확률 높은 프리미엄 계정."
  }
];

let activeSelectedProduct = null;

function getStoredProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
      return DEFAULT_PRODUCTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PRODUCTS;
  }
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_USER);
  }
  updateAuthHeader();
}

function showToast(msg) {
  const box = document.getElementById("toast-box");
  const text = document.getElementById("toast-message");
  text.innerText = msg;
  box.classList.remove("hidden");
  setTimeout(() => {
    box.classList.add("hidden");
  }, 3000);
}

function updateAuthHeader() {
  const user = getCurrentUser();
  const authArea = document.getElementById("header-auth-area");

  if (!user) {
    authArea.innerHTML = `
      <button onclick="handleDiscordLogin()" class="discord-btn text-xs sm:text-sm px-4 py-2 flex items-center gap-1.5 cursor-pointer font-bold tracking-tight">
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
        <span>Discord로 시작하기</span>
      </button>
    `;
  } else {
    authArea.innerHTML = `
      <div class="flex items-center gap-2">
        <button onclick="openDepositModal()" class="bg-[#f3e8ff] hover:bg-[#e9d5ff] text-[#6d28d9] px-3 py-1.5 rounded-full text-xs font-bold transition-all">
          💳 ${user.points.toLocaleString()}원
        </button>
        <button onclick="handleLogout()" class="text-xs text-neutral-500 hover:text-neutral-900 font-medium px-2 py-1">
          로그아웃
        </button>
      </div>
    `;
  }
}

function handleDiscordLogin() {
  window.location.href = `${WORKER_URL}/api/auth/discord/login`;
}

function handleLogout() {
  setCurrentUser(null);
  showToast("로그아웃되었습니다.");
}

function renderProductList() {
  const container = document.getElementById("product-list");
  const products = getStoredProducts();
  container.innerHTML = "";

  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "account-card product-card p-6 md:p-7 flex flex-col justify-between relative overflow-hidden select-none";
    card.onclick = () => openProductModal(p);

    card.innerHTML = `
      <div class="text-left">
        <h2 class="text-xl md:text-2xl font-extrabold text-[#111111] tracking-tight">
          ${escapeHtml(p.title)}
        </h2>
      </div>

      <div class="py-2.5 text-left">
        <p class="text-sm md:text-base font-semibold text-[#4a4a4a]">
          ${escapeHtml(p.description)}
        </p>
      </div>

      <div class="flex items-baseline justify-between pt-2 border-t border-black/5 mt-1">
        <div class="text-xs font-bold text-[#737373] tracking-wide">
          재고 ${p.stock}개
        </div>
        <div class="text-2xl md:text-3xl font-black text-[#6d28d9] tracking-tight price-text">
          ${p.price.toLocaleString()}원
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function openProductModal(p) {
  activeSelectedProduct = p;
  document.getElementById("modal-title").innerText = p.title;
  document.getElementById("modal-desc").innerText = p.description;
  document.getElementById("modal-skins").innerText = p.skins || "-";
  document.getElementById("modal-stock").innerText = `${p.stock}개 보유`;
  document.getElementById("modal-server").innerText = p.server || "한국 (KR)";
  document.getElementById("modal-server-detail").innerText = p.server || "한국 (KR)";
  document.getElementById("modal-price").innerText = `${p.price.toLocaleString()}원`;
  document.getElementById("modal-details").innerText = p.details || "안전 보증 계정입니다.";
  document.getElementById("modal-purchase-text").innerText = `${p.price.toLocaleString()}원에 구매하기`;

  const statusBox = document.getElementById("purchase-status-box");
  statusBox.classList.add("hidden");

  document.getElementById("product-detail-modal").classList.remove("hidden");
}

function closeProductModal() {
  document.getElementById("product-detail-modal").classList.add("hidden");
  activeSelectedProduct = null;
}

function openDepositModal() {
  document.getElementById("deposit-modal").classList.remove("hidden");
}

function closeDepositModal() {
  document.getElementById("deposit-modal").classList.add("hidden");
}

function handleDepositSubmit(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) {
    showToast("먼저 Discord로 시작하기를 눌러 로그인해주세요.");
    return;
  }
  const bank = document.getElementById("deposit-bank").value;
  const amount = parseInt(document.getElementById("deposit-amount").value, 10);
  const name = document.getElementById("deposit-name").value.trim();

  fetch(`${WORKER_URL}/api/deposits`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, depositor_name: name, bank_name: bank }) })
    .then(r => r.json()).then(data => {
      if (!data.success) throw new Error(data.error || "입금 신청에 실패했습니다.");
      closeDepositModal();
      showToast("입금 신청 완료! 관리자 승인 후 포인트가 지급됩니다.");
      loadUserActivity();
    }).catch(err => showToast(err.message));
}

async function executePurchase() {
  if (!activeSelectedProduct) return;
  const user = getCurrentUser();
  if (!user) {
    showToast("구매하려면 먼저 Discord로 시작하기를 진행해주세요.");
    return;
  }

  const p = activeSelectedProduct;
  if (user.points < p.price) {
    showToast(`포인트가 부족합니다. (보유: ${user.points}원 / 필요: ${p.price}원)`);
    return;
  }
  if (p.stock <= 0) {
    showToast("재고가 모두 소진되었습니다.");
    return;
  }

  try {
    const response = await fetch(`${WORKER_URL}/api/orders`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: p.id }) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "구매에 실패했습니다.");
    const cred = result.account_data;
    const fresh = await fetch(`${WORKER_URL}/api/auth/me`, { credentials: "include" }).then(r => r.json());
    setCurrentUser(fresh);
    renderProductList();

  const statusBox = document.getElementById("purchase-status-box");
  statusBox.className = "mb-4 p-3.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-300";
  statusBox.innerHTML = `
    <div class="font-bold text-emerald-800">구매 성공! 출고된 계정 정보:</div>
    <div class="mt-1 font-mono text-xs select-all bg-white p-2 rounded border border-emerald-200">${cred}</div>
  `;
  statusBox.classList.remove("hidden");
    loadUserActivity();
    showToast("구매가 완료되었습니다!");
  } catch (err) {
    showToast(err.message);
  }
}

async function loadUserActivity() {
  const user = getCurrentUser();
  const panel = document.getElementById("user-activity");
  if (!user || !panel) return;
  panel.classList.remove("hidden");
  try {
    const [orders, inquiries, deposits] = await Promise.all([
      fetch(`${WORKER_URL}/api/orders`, { credentials: "include" }).then(r => r.json()),
      fetch(`${WORKER_URL}/api/inquiries`, { credentials: "include" }).then(r => r.json()),
      fetch(`${WORKER_URL}/api/deposits`, { credentials: "include" }).then(r => r.json())
    ]);
    document.getElementById("order-history").innerHTML = orders.length ? orders.map(o => `<div class="activity-row"><b>${escapeHtml(o.product_title)}</b><span>${escapeHtml(o.account_data || "출고 준비")}</span><small>${escapeHtml(o.created_at || "")}</small></div>`).join("") : `<p class="empty-state">아직 구매내역이 없습니다.</p>`;
    document.getElementById("inquiry-history").innerHTML = inquiries.length ? inquiries.map(i => `<div class="activity-row"><b>${escapeHtml(i.title)}</b><span>${escapeHtml(i.reply || "답변 대기 중")}</span><small>${escapeHtml(i.status || "pending")}</small></div>`).join("") : `<p class="empty-state">문의내역이 없습니다.</p>`;
    document.getElementById("deposit-history").innerHTML = deposits.length ? deposits.map(d => `<div class="activity-row"><b>${Number(d.amount).toLocaleString()}원</b><span>${escapeHtml(d.status)}</span><small>${escapeHtml(d.created_at || "")}</small></div>`).join("") : `<p class="empty-state">입금 신청내역이 없습니다.</p>`;
  } catch { showToast("내역을 불러오지 못했습니다."); }
}

async function submitInquiry(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return showToast("먼저 Discord 로그인을 해주세요.");
  const title = document.getElementById("inquiry-title").value.trim();
  const message = document.getElementById("inquiry-message").value.trim();
  const res = await fetch(`${WORKER_URL}/api/inquiries`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, message }) });
  if (!res.ok) return showToast("문의 등록에 실패했습니다.");
  e.target.reset();
  showToast("문의가 등록되었습니다.");
  loadUserActivity();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener("DOMContentLoaded", () => {
  updateAuthHeader();
  renderProductList();
  fetch(`${WORKER_URL}/api/auth/me`, { credentials: "include" }).then(r => r.ok ? r.json() : null).then(user => {
    if (user) { setCurrentUser(user); loadUserActivity(); }
  }).catch(() => {});

  window.addEventListener("vm_data_updated", () => {
    renderProductList();
  });
  window.addEventListener("vm_auth_updated", () => {
    updateAuthHeader();
  });
});
