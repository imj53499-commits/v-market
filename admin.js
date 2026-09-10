// Admin Panel Logic for V-MARKET
// Synchronized with localStorage and Cloudflare D1 API

const STORAGE_KEY_PRODUCTS = "vm_products_db";
const STORAGE_KEY_DEPOSITS = "vm_deposits_db";
const STORAGE_KEY_ORDERS = "vm_orders_db";
const STORAGE_KEY_INQUIRIES = "vm_inquiries_db";
const STORAGE_KEY_USER = "vm_user_session";
const ADMIN_DISCORD_ID = "1547549857231675411";
const WORKER_URL = "https://v-market.imj53499.workers.dev";
const INITIAL_PRODUCTS = [
  { id: 1, title: "스킨 0~10", description: "스킨 0~10개짜리 계정", skins: "0~10개 무작위", stock: 62, price: 10, server: "한국 (KR)", details: "안전 계정 보증", status: "active" },
  { id: 2, title: "스킨 11~20", description: "스킨 11~20개짜리 계정", skins: "11~20개 무작위", stock: 45, price: 50, server: "한국 (KR)", details: "안전 계정 보증", status: "active" },
  { id: 3, title: "스킨 21~30", description: "스킨 21~30개짜리 계정", skins: "21~30개 무작위", stock: 28, price: 100, server: "한국 (KR)", details: "안전 계정 보증", status: "active" },
  { id: 4, title: "스킨 31~40", description: "스킨 31~40개짜리 계정", skins: "31~40개 무작위", stock: 14, price: 300, server: "한국 (KR)", details: "안전 계정 보증", status: "active" }
];

function getProducts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (data) return JSON.parse(data);
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  } catch {
    return INITIAL_PRODUCTS;
  }
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
  window.dispatchEvent(new Event("vm_data_updated"));
}

function showAdminSaveHint(message = "저장됨") {
  const hint = document.getElementById('admin-save-hint');
  if (!hint) return;
  hint.innerText = message;
  clearTimeout(window.__vmHintTimer);
  window.__vmHintTimer = setTimeout(() => { hint.innerText = ''; }, 2200);
}

function getDeposits() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_DEPOSITS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveDeposits(deposits) {
  localStorage.setItem(STORAGE_KEY_DEPOSITS, JSON.stringify(deposits));
  window.dispatchEvent(new Event("vm_data_updated"));
}

function getOrders() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_ORDERS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function getInquiries() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_INQUIRIES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveInquiries(inquiries) {
  localStorage.setItem(STORAGE_KEY_INQUIRIES, JSON.stringify(inquiries));
  window.dispatchEvent(new Event("vm_data_updated"));
}

function renderAdminGate() {
  const main = document.querySelector('main');
  if (main) main.style.display = 'none';
  const gate = document.createElement('div');
  gate.style.cssText = 'min-height:calc(100vh - 72px);display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;';
  gate.innerHTML = '<div style="max-width:420px;background:#16181f;border:1px solid #34394a;border-radius:20px;padding:32px;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.35)"><div style="font-size:36px;margin-bottom:12px">🔒</div><h1 style="font-size:22px;font-weight:800;margin:0 0 10px">관리자 접근 제한</h1><p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 22px">등록된 관리자 Discord 계정으로 로그인한 경우에만 접근할 수 있습니다.</p><a href="/" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:12px;background:#6d28d9;color:#fff;text-decoration:none;font-weight:700;font-size:14px">메인 사이트로 돌아가기</a></div>';
  document.body.appendChild(gate);
}

async function guardAdminAccess() {
  try {
    const localUser = JSON.parse(localStorage.getItem(STORAGE_KEY_USER) || "null");
    if (localUser?.id === ADMIN_DISCORD_ID) return true;
  } catch {}

  // Production path: Worker validates the HttpOnly Discord session cookie.
  try {
    const response = await fetch(`${WORKER_URL}/api/auth/me`, { credentials: 'include' });
    if (response.ok) {
      const user = await response.json();
      if (user?.id === ADMIN_DISCORD_ID && user?.role === 'admin') return true;
    }
  } catch {}

  renderAdminGate();
  return false;
}

function switchTab(tabId) {
  const tabs = ['products', 'deposits', 'orders', 'inquiries'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (t === tabId) {
      el.classList.remove('hidden');
      btn.className = "px-4 py-2 font-black text-white border-b-2 border-purple-500";
    } else {
      el.classList.add('hidden');
      btn.className = "px-4 py-2 font-bold text-neutral-400 hover:text-white";
    }
  });
}

function renderAll() {
  renderStats();
  renderProducts();
  renderDeposits();
  renderOrders();
  renderInquiries();
}

function renderStats() {
  const products = getProducts();
  const deposits = getDeposits();
  const orders = getOrders();
  const inquiries = getInquiries();

  document.getElementById('stat-products').innerText = products.length;
  document.getElementById('stat-deposits').innerText = deposits.filter(d => d.status === 'pending').length;
  document.getElementById('stat-orders').innerText = orders.length;
  document.getElementById('stat-inquiries').innerText = inquiries.filter(i => i.status === 'open').length;
}

function renderProducts() {
  const products = getProducts();
  const tbody = document.getElementById('product-table-body');
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-neutral-500">등록된 상품이 없습니다.</td></tr>`;
    return;
  }

  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#181b24] transition-colors";
    tr.innerHTML = `
      <td class="p-4 text-neutral-400 font-mono text-xs">#${p.id}</td>
      <td class="p-4 font-black text-white text-base">${escapeHtml(p.title)}</td>
      <td class="p-4 text-neutral-300 text-xs font-medium">${escapeHtml(p.description)}</td>
      <td class="p-4 text-xs text-neutral-400">${escapeHtml(p.skins || '-')}</td>
      <td class="p-4">
        <div class="flex items-center gap-1.5">
          <input type="number" min="0" value="${p.stock}" onchange="quickUpdateStock(${p.id}, this.value)" class="w-16 bg-[#090a0f] border border-[#232733] rounded px-2 py-1 text-xs text-white font-bold text-center focus:border-purple-500 outline-none" />
          <span class="text-xs text-neutral-500">개</span>
        </div>
      </td>
      <td class="p-4">
        <div class="flex items-center gap-1.5">
          <input type="number" min="0" value="${p.price}" onchange="quickUpdatePrice(${p.id}, this.value)" class="w-20 bg-[#090a0f] border border-[#232733] rounded px-2 py-1 text-xs text-purple-400 font-extrabold text-right focus:border-purple-500 outline-none" />
          <span class="text-xs font-bold text-purple-400">원</span>
        </div>
      </td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editProduct(${p.id})" class="text-xs font-bold text-neutral-200 hover:text-white bg-[#222736] hover:bg-[#2c3347] px-3 py-1.5 rounded-lg border border-neutral-700 transition-colors">수정</button>
        <button onclick="deleteProduct(${p.id})" class="text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/50 px-3 py-1.5 rounded-lg transition-colors">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function quickUpdateStock(id, newStock) {
  const products = getProducts();
  const item = products.find(p => p.id === id);
  if (item) {
    item.stock = Math.max(0, parseInt(newStock, 10) || 0);
    saveProducts(products);
    renderStats();
    showAdminSaveHint(`상품 #${id} 재고가 ${item.stock}개로 저장되었습니다.`);
  }
}

function quickUpdatePrice(id, newPrice) {
  const products = getProducts();
  const item = products.find(p => p.id === id);
  if (item) {
    item.price = Math.max(0, parseInt(newPrice, 10) || 0);
    saveProducts(products);
    renderStats();
    showAdminSaveHint(`상품 #${id} 가격이 ${item.price.toLocaleString()}원으로 저장되었습니다.`);
  }
}

function openAddProductModal() {
  document.getElementById('product-modal-title').innerText = "새 발로란트 계정 상품 추가";
  document.getElementById('form-product-id').value = '';
  document.getElementById('form-product-title').value = '';
  document.getElementById('form-product-desc').value = '';
  document.getElementById('form-product-price').value = '100';
  document.getElementById('form-product-stock').value = '50';
  document.getElementById('form-product-skins').value = '0~10개 무작위';
  document.getElementById('form-product-server').value = '한국 (KR)';
  document.getElementById('form-product-details').value = '안전 계정 보증, 이메일 변경 가능';
  document.getElementById('product-modal').classList.remove('hidden');
}

function editProduct(id) {
  const products = getProducts();
  const item = products.find(p => p.id === id);
  if (!item) return;

  document.getElementById('product-modal-title').innerText = `상품 상세 수정 (#${item.id})`;
  document.getElementById('form-product-id').value = item.id;
  document.getElementById('form-product-title').value = item.title;
  document.getElementById('form-product-desc').value = item.description;
  document.getElementById('form-product-price').value = item.price;
  document.getElementById('form-product-stock').value = item.stock;
  document.getElementById('form-product-skins').value = item.skins || '';
  document.getElementById('form-product-server').value = item.server || '한국 (KR)';
  document.getElementById('form-product-details').value = item.details || '';
  document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

function handleProductFormSubmit(e) {
  e.preventDefault();
  const idStr = document.getElementById('form-product-id').value;
  const title = document.getElementById('form-product-title').value.trim();
  const description = document.getElementById('form-product-desc').value.trim();
  const price = parseInt(document.getElementById('form-product-price').value, 10) || 0;
  const stock = parseInt(document.getElementById('form-product-stock').value, 10) || 0;
  const skins = document.getElementById('form-product-skins').value.trim();
  const server = document.getElementById('form-product-server').value.trim();
  const details = document.getElementById('form-product-details').value.trim();

  const products = getProducts();

  if (idStr) {
    const id = parseInt(idStr, 10);
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], title, description, price, stock, skins, server, details };
    }
  } else {
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({
      id: newId,
      title,
      description,
      price,
      stock,
      skins,
      server,
      details,
      status: 'active'
    });
  }

  saveProducts(products);
  closeProductModal();
  renderAll();
  showAdminSaveHint(idStr ? '상품 수정 내용이 저장되었습니다.' : '새 상품이 추가되었습니다.');
}

function deleteProduct(id) {
  if (!confirm(`정말로 ID #${id} 상품을 삭제하시겠습니까?`)) return;
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
  renderAll();
}

function renderDeposits() {
  const deposits = getDeposits();
  const tbody = document.getElementById('deposit-table-body');
  tbody.innerHTML = '';

  if (deposits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-neutral-500">입금 신청 내역이 없습니다.</td></tr>`;
    return;
  }

  deposits.forEach(d => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#181b24] transition-colors";
    const isPending = d.status === 'pending';
    tr.innerHTML = `
      <td class="p-4 text-neutral-400 font-mono text-xs">#${d.id}</td>
      <td class="p-4 font-bold text-white">${escapeHtml(d.userName)}</td>
      <td class="p-4 font-black text-purple-400 text-base">${d.amount.toLocaleString()}원</td>
      <td class="p-4 text-neutral-200 font-bold">${escapeHtml(d.depositorName)}</td>
      <td class="p-4 text-neutral-400 text-xs">${escapeHtml(d.bankName)}</td>
      <td class="p-4 text-neutral-500 text-xs">${escapeHtml(d.createdAt)}</td>
      <td class="p-4">
        <span class="text-[11px] px-2.5 py-1 rounded-md font-bold ${
          d.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
          d.status === 'rejected' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
          'bg-amber-950 text-amber-300 border border-amber-800'
        }">
          ${d.status === 'approved' ? '승인완료' : d.status === 'rejected' ? '반려됨' : '입금대기'}
        </span>
      </td>
      <td class="p-4 text-right space-x-2">
        ${isPending ? `
          <button onclick="approveDeposit(${d.id})" class="text-xs font-black text-emerald-300 bg-emerald-900/60 hover:bg-emerald-800/80 px-3.5 py-1.5 rounded-lg border border-emerald-700/60 transition-colors">승인 & 포인트지급</button>
          <button onclick="rejectDeposit(${d.id})" class="text-xs text-neutral-400 hover:text-white bg-neutral-800 px-2.5 py-1.5 rounded-lg transition-colors">반려</button>
        ` : `<span class="text-xs text-neutral-500 font-medium">처리완료</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function approveDeposit(id) {
  const deposits = getDeposits();
  const d = deposits.find(item => item.id === id);
  if (!d) return;

  d.status = 'approved';
  saveDeposits(deposits);

  try {
    const userRaw = localStorage.getItem(STORAGE_KEY_USER);
    if (userRaw) {
      const u = JSON.parse(userRaw);
      if (u.id === d.userId) {
        u.points += d.amount;
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(u));
        window.dispatchEvent(new Event("vm_auth_updated"));
      }
    }
  } catch {}

  renderAll();
  alert(`${d.depositorName}님의 ${d.amount.toLocaleString()}원 입금이 승인되어 포인트가 충전되었습니다.`);
}

function rejectDeposit(id) {
  const deposits = getDeposits();
  const d = deposits.find(item => item.id === id);
  if (!d) return;

  d.status = 'rejected';
  saveDeposits(deposits);
  renderAll();
}

function renderOrders() {
  const orders = getOrders();
  const tbody = document.getElementById('order-table-body');
  tbody.innerHTML = '';

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-neutral-500">출고 및 주문 내역이 없습니다.</td></tr>`;
    return;
  }

  orders.forEach(o => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#181b24] transition-colors";
    tr.innerHTML = `
      <td class="p-4 font-mono text-xs text-neutral-400 font-semibold">${escapeHtml(o.orderNumber)}</td>
      <td class="p-4 font-bold text-white">${escapeHtml(o.userName)}</td>
      <td class="p-4 text-xs text-neutral-200 font-bold">${escapeHtml(o.productTitle)}</td>
      <td class="p-4 font-black text-purple-400 text-sm">${o.price.toLocaleString()}원</td>
      <td class="p-4 font-mono text-xs text-emerald-400 bg-neutral-900/60 p-2 rounded select-all border border-neutral-800">${escapeHtml(o.accountData)}</td>
      <td class="p-4 text-xs text-neutral-500">${escapeHtml(o.createdAt)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderInquiries() {
  const inquiries = getInquiries();
  const tbody = document.getElementById('inquiry-table-body');
  tbody.innerHTML = '';

  if (inquiries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-neutral-500">등록된 고객 문의가 없습니다.</td></tr>`;
    return;
  }

  inquiries.forEach(i => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#181b24] transition-colors";
    tr.innerHTML = `
      <td class="p-4 text-neutral-400 font-mono text-xs">#${i.id}</td>
      <td class="p-4 font-bold text-white">${escapeHtml(i.userName)}</td>
      <td class="p-4 font-bold text-neutral-200">${escapeHtml(i.title)}</td>
      <td class="p-4 text-xs text-neutral-300 max-w-xs">${escapeHtml(i.message)}</td>
      <td class="p-4 text-xs ${i.reply ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-medium'}">
        ${i.reply ? escapeHtml(i.reply) : '<span class="italic text-neutral-500">답변 대기 중</span>'}
      </td>
      <td class="p-4 text-xs text-neutral-500">${escapeHtml(i.createdAt)}</td>
      <td class="p-4 text-right">
        <button onclick="replyToInquiry(${i.id})" class="text-xs bg-purple-900/60 hover:bg-purple-800 text-purple-200 px-3.5 py-1.5 rounded-lg font-bold border border-purple-700/60 transition-colors">
          ${i.reply ? '답변수정' : '답변작성'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function replyToInquiry(id) {
  const inquiries = getInquiries();
  const item = inquiries.find(i => i.id === id);
  if (!item) return;

  const currentReply = item.reply || '';
  const answer = prompt(`"${item.title}" 문의에 대한 답변을 입력하세요:`, currentReply);
  if (answer !== null) {
    item.reply = answer.trim();
    item.status = answer.trim() ? 'answered' : 'open';
    saveInquiries(inquiries);
    renderAll();
  }
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

window.addEventListener('DOMContentLoaded', async () => {
  if (await guardAdminAccess()) renderAll();
});
