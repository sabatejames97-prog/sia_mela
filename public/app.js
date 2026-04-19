// app.js – shared across all pages
// @ts-nocheck

// app.js – Pharmacy Inventory System (Strapi v5) – NO INLINE SCRIPTS
const API_URL = '/api';   // Change to full URL if frontend is separate

// ==================== AUTH & HELPERS ====================
function isAuthenticated() { return !!localStorage.getItem('jwt'); }
function getUser() { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; }
function getUserRole() {
  const user = getUser();
  if (!user) return null;
  if (user.role && typeof user.role === 'object' && user.role.name) {
    const r = user.role.name.toLowerCase();
    if (r === 'admin') return 'admin';
    if (r === 'staff') return 'staff';
  }
  if (user.role && typeof user.role === 'string') {
    const r = user.role.toLowerCase();
    if (r === 'admin') return 'admin';
    if (r === 'staff') return 'staff';
  }
  const email = (user.email || '').toLowerCase();
  const adminEmails = ['admin-phar@gmail.com', 'admin@admin.com'];
  if (adminEmails.includes(email)) return 'admin';
  if (email.includes('admin') || email.includes('phar')) return 'admin';
  return 'staff';
}
async function apiCall(endpoint, options = {}) {
  const jwt = localStorage.getItem('jwt');
  const headers = { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) };
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  if (!res.ok) { const err = await res.text(); throw new Error(err || `HTTP ${res.status}`); }
  return res.json();
}
async function fetchMedicines() {
  try { const data = await apiCall('/medicines?populate=*'); return data.data || []; } catch (err) { console.error(err); return []; }
}
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

// ==================== DASHBOARD ====================
async function loadDashboardData() {
  const medicines = await fetchMedicines();
  let totalStock = 0, lowStockCount = 0, expiredCount = 0;
  const today = new Date().toISOString().slice(0,10);
  medicines.forEach(med => { (med.batch || []).forEach(b => { totalStock += b.stock || 0; if (!b.is_expired && b.stock <= 5) lowStockCount++; if (b.expiration_date < today) expiredCount++; }); });
  document.getElementById('statsCards').innerHTML = `<div class="stat-card"><div class="stat-info"><h3>${medicines.length}</h3><p>Medicines</p></div><div class="stat-icon"><i class="fas fa-pills"></i></div></div><div class="stat-card"><div class="stat-info"><h3>${totalStock}</h3><p>Total Stock</p></div><div class="stat-icon"><i class="fas fa-boxes"></i></div></div><div class="stat-card"><div class="stat-info"><h3>${lowStockCount}</h3><p>Low Stock Items</p></div><div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div></div><div class="stat-card"><div class="stat-info"><h3>${expiredCount}</h3><p>Expired Batches</p></div><div class="stat-icon"><i class="fas fa-calendar-times"></i></div></div>`;
  const lowStockItems = [], expiredItems = [];
  medicines.forEach(med => { (med.batch || []).forEach(b => { if (!b.is_expired && b.stock <= 5) lowStockItems.push({ name: med.medicine_name, batch: b.batch_note, stock: b.stock }); if (b.expiration_date < today) expiredItems.push({ name: med.medicine_name, batch: b.batch_note, expiry: b.expiration_date }); }); });
  document.getElementById('alerts').innerHTML = `<div class="bg-white p-5 rounded-xl shadow border-l-4 border-yellow-500"><h3 class="font-semibold text-lg"><i class="fas fa-exclamation-triangle text-yellow-500"></i> Low Stock (≤5)</h3>${lowStockItems.length ? lowStockItems.map(i => `<p class="mt-1">${i.name} (${i.batch}) – stock: ${i.stock}</p>`).join('') : '<p class="text-gray-500 mt-1">No low stock items</p>'}</div><div class="bg-white p-5 rounded-xl shadow border-l-4 border-red-500"><h3 class="font-semibold text-lg"><i class="fas fa-calendar-times text-red-500"></i> Expired Medicines</h3>${expiredItems.length ? expiredItems.map(i => `<p class="mt-1">${i.name} (${i.batch}) expired on ${i.expiry}</p>`).join('') : '<p class="text-gray-500 mt-1">No expired medicines</p>'}</div>`;
  const recent = medicines.slice(0,5);
  document.getElementById('recentMedicinesTable').innerHTML = `<div class="data-row font-semibold bg-gray-100"><span>Medicine</span><span>Type</span><span>Total Stock</span></div>${recent.map(med => `<div class="data-row"><span>${med.medicine_name}</span><span>${med.medicine_type || ''}</span><span>${(med.batch || []).reduce((s,b)=>s+b.stock,0)}</span></div>`).join('')}`;
}

// ==================== MEDICINES ====================
async function renderMedicinesFull() {
  const medicines = await fetchMedicines();
  const container = document.getElementById('medicinesList');
  const role = getUserRole();
  const canManage = (role === 'admin' || role === 'staff');
  if (!container) return;
  if (medicines.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 p-10">No medicines found. Click "Add Medicine" to create one.</div>'; return; }
  container.innerHTML = medicines.map(med => {
    const batches = med.batch || [];
    const batchesJson = JSON.stringify(batches).replace(/"/g, '&quot;');
    return `
      <div class="border rounded-xl p-5 mb-5 bg-white shadow-sm" data-medicine-id="${med.documentId}">
        <div class="flex justify-between items-start">
          <div><h3 class="text-2xl font-bold">${escapeHtml(med.medicine_name)}</h3><p class="text-gray-600 mt-1">${escapeHtml(med.medicine_desc)} | ${escapeHtml(med.medicine_type)}</p></div>
          ${canManage ? `<div class="flex gap-2"><button class="btn-sm btn-secondary edit-medicine-btn" data-id="${med.documentId}" data-name="${escapeHtml(med.medicine_name)}" data-desc="${escapeHtml(med.medicine_desc)}" data-type="${escapeHtml(med.medicine_type)}" data-image="${med.is_prescription ? med.is_prescription.id : ''}"><i class="fas fa-edit"></i> Edit</button><button class="btn-sm btn-primary add-stock-btn" data-id="${med.documentId}" data-name="${escapeHtml(med.medicine_name)}" data-batches='${batchesJson}'><i class="fas fa-plus-circle"></i> Add Stock</button></div>` : ''}
        </div>
        <table class="min-w-full mt-4 text-sm"><thead><tr class="bg-gray-100"><th class="p-2">Batch</th><th>Expiry</th><th>Stock</th><th>Price</th><th>Status</th></tr></thead><tbody>${batches.map(b => `<tr><td class="p-2">${escapeHtml(b.batch_note)}</td><td class="p-2">${escapeHtml(b.expiration_date)}</td><td class="p-2">${b.stock}</td><td class="p-2">₱${b.sellingPrice}</td><td class="p-2">${b.is_expired ? '<span class="text-red-500 font-semibold">Expired</span>' : '<span class="text-green-600 font-semibold">Active</span>'}</td></tr>`).join('')}</tbody></table>
      </div>`;
  }).join('');
}

// Add Medicine
async function addMedicine(e) {
  e.preventDefault();
  const name = document.getElementById('medicine_name').value.trim();
  const desc = document.getElementById('medicine_desc').value.trim();
  const type = document.getElementById('medicine_type').value;
  const batchNote = document.getElementById('batch_note').value.trim();
  const expiry = document.getElementById('expiration_date').value;
  const stock = parseInt(document.getElementById('stock').value);
  const price = parseFloat(document.getElementById('sellingPrice').value);
  if (!name || !desc || !batchNote || !expiry || isNaN(stock) || isNaN(price)) { alert('All fields required'); return; }
  const imgFile = document.getElementById('prescriptionImage').files[0];
  let prescriptionId = null;
  if (imgFile) {
    const fd = new FormData(); fd.append('files', imgFile);
    const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` }, body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    if (data && data[0]) prescriptionId = data[0].id;
  }
  const medicineData = { data: { medicine_name: name, medicine_desc: desc, medicine_type: type, batch: [{ batch_note: batchNote, expiration_date: expiry, stock, sellingPrice: price, is_expired: false }] } };
  if (prescriptionId) medicineData.data.is_prescription = prescriptionId;
  try { await apiCall('/medicines', { method: 'POST', body: JSON.stringify(medicineData) }); alert('Medicine added'); document.getElementById('medicineModal').style.display = 'none'; document.getElementById('addMedicineForm').reset(); await renderMedicinesFull(); } catch (err) { alert(err.message); }
}
function closeMedicineModal() { document.getElementById('medicineModal').style.display = 'none'; }

// Edit Medicine
let editOldImageId = null;
function openEditMedicineModal(id, name, desc, type, oldImg) { editOldImageId = oldImg; document.getElementById('editMedicineId').value = id; document.getElementById('edit_medicine_name').value = name; document.getElementById('edit_medicine_desc').value = desc; document.getElementById('edit_medicine_type').value = type; document.getElementById('edit_prescriptionImage').value = ''; document.getElementById('editMedicineModal').style.display = 'flex'; }
function closeEditMedicineModal() { document.getElementById('editMedicineModal').style.display = 'none'; }
async function editMedicineSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editMedicineId').value;
  const name = document.getElementById('edit_medicine_name').value;
  const desc = document.getElementById('edit_medicine_desc').value;
  const type = document.getElementById('edit_medicine_type').value;
  const imgFile = document.getElementById('edit_prescriptionImage').files[0];
  let prescriptionId = null;
  if (imgFile) {
    const fd = new FormData(); fd.append('files', imgFile);
    const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` }, body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    if (data && data[0]) prescriptionId = data[0].id;
  }
  const update = { data: { medicine_name: name, medicine_desc: desc, medicine_type: type } };
  if (prescriptionId) update.data.is_prescription = prescriptionId;
  try { await apiCall(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(update) }); alert('Updated'); closeEditMedicineModal(); await renderMedicinesFull(); } catch (err) { alert(err.message); }
}

// Add Stock
let currentStockMedicine = null;
function openEditStockModal(id, name, batchesJson) { currentStockMedicine = { documentId: id, name, batches: JSON.parse(batchesJson) }; document.getElementById('editMedicineIdForStock').value = id; document.getElementById('editMedicineName').value = name; const select = document.getElementById('existingBatchSelect'); select.innerHTML = '<option value="new">+ Add New Batch</option>'; currentStockMedicine.batches.forEach(b => { select.innerHTML += `<option value="${b.batch_note}" data-expiry="${b.expiration_date}" data-price="${b.sellingPrice}">${b.batch_note} (Exp: ${b.expiration_date}, Stock: ${b.stock}, Price: ₱${b.sellingPrice})</option>`; }); document.getElementById('newBatchFields').style.display = 'none'; document.getElementById('addQuantity').value = 1; document.getElementById('editStockModal').style.display = 'flex'; select.onchange = () => { document.getElementById('newBatchFields').style.display = select.value === 'new' ? 'block' : 'none'; }; }
function closeEditStockModal() { document.getElementById('editStockModal').style.display = 'none'; currentStockMedicine = null; }
async function addStockToMedicine(e) {
  e.preventDefault();
  const id = document.getElementById('editMedicineIdForStock').value;
  const qty = parseInt(document.getElementById('addQuantity').value);
  const select = document.getElementById('existingBatchSelect');
  const selected = select.value;
  if (!currentStockMedicine || isNaN(qty) || qty <= 0) { alert('Valid quantity required'); return; }
  let updated = [...currentStockMedicine.batches];
  if (selected === 'new') {
    const newBatch = document.getElementById('newBatchNote').value.trim();
    const newExpiry = document.getElementById('newExpirationDate').value;
    const newPrice = parseFloat(document.getElementById('newSellingPrice').value);
    if (!newBatch || !newExpiry || isNaN(newPrice)) { alert('New batch fields required'); return; }
    updated.push({ batch_note: newBatch, expiration_date: newExpiry, stock: qty, sellingPrice: newPrice, is_expired: false });
  } else {
    updated = updated.map(b => b.batch_note === selected ? { ...b, stock: b.stock + qty } : b);
  }
  try { await apiCall(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify({ data: { batch: updated } }) }); alert('Stock added'); closeEditStockModal(); await renderMedicinesFull(); } catch (err) { alert(err.message); }
}

// ==================== SALES ====================
let currentSaleMedicine = null, currentSaleBatch = null;
async function initSaleTable() {
  const medicines = await fetchMedicines();
  const available = medicines.filter(m => (m.batch || []).some(b => !b.is_expired && b.stock > 0));
  const select = document.getElementById('medicineSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Select medicine</option>' + available.map(m => `<option value="${m.documentId}">${m.medicine_name}</option>`).join('');
  select.addEventListener('change', async () => {
    const id = select.value;
    if (!id) { document.getElementById('batchTableContainer').style.display = 'none'; return; }
    currentSaleMedicine = available.find(m => m.documentId === id);
    renderBatchTable(currentSaleMedicine);
  });
}
function renderBatchTable(medicine) {
  const batches = medicine.batch.filter(b => !b.is_expired && b.stock > 0);
  const container = document.getElementById('batchTable');
  const tableContainer = document.getElementById('batchTableContainer');
  if (batches.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 p-4">No active batches available.</div>'; tableContainer.style.display = 'block'; return; }
  let html = `<table class="min-w-full bg-white border rounded-lg overflow-hidden"><thead class="bg-gray-100"><tr><th class="p-2 border">Batch Number</th><th class="p-2 border">Expiry Date</th><th class="p-2 border">Stock</th><th class="p-2 border">Price</th><th class="p-2 border">Action</th></tr></thead><tbody>`;
  batches.forEach(b => { html += `<tr><td class="p-2 border">${escapeHtml(b.batch_note)}</td><td class="p-2 border">${escapeHtml(b.expiration_date)}</td><td class="p-2 border">${b.stock}</td><td class="p-2 border">₱${b.sellingPrice}</td><td class="p-2 border"><button class="btn-sm btn-primary sell-batch-btn" data-batch='${JSON.stringify(b).replace(/'/g, "&#39;")}'>Sell</button></td></tr>`; });
  html += `</tbody></table>`;
  container.innerHTML = html;
  tableContainer.style.display = 'block';
  document.querySelectorAll('.sell-batch-btn').forEach(btn => { btn.addEventListener('click', () => { const batch = JSON.parse(btn.getAttribute('data-batch')); currentSaleBatch = batch; openQuantityModal(batch); }); });
}
function openQuantityModal(batch) {
  document.getElementById('selectedBatchInfo').innerHTML = `Batch: ${batch.batch_note}<br>Price: ₱${batch.sellingPrice}<br>Max stock: ${batch.stock}`;
  document.getElementById('saleQuantity').value = 1; document.getElementById('saleQuantity').max = batch.stock;
  document.getElementById('saleTotal').innerHTML = `Total: ₱${batch.sellingPrice}`;
  document.getElementById('quantityModal').style.display = 'flex';
  const qtyInput = document.getElementById('saleQuantity');
  qtyInput.oninput = () => { const q = parseInt(qtyInput.value) || 0; document.getElementById('saleTotal').innerHTML = `Total: ₱${(q * batch.sellingPrice).toFixed(2)}`; };
  const confirmBtn = document.getElementById('confirmSaleBtn');
  const newBtn = confirmBtn.cloneNode(true); confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  newBtn.addEventListener('click', async () => await completeSale(batch));
}
function closeQuantityModal() { document.getElementById('quantityModal').style.display = 'none'; document.getElementById('saleMessage').innerHTML = ''; }
async function completeSale(batch) {
  const qty = parseInt(document.getElementById('saleQuantity').value);
  if (isNaN(qty) || qty <= 0 || qty > batch.stock) { document.getElementById('saleMessage').innerHTML = '<span class="text-red-500">Invalid quantity</span>'; return; }
  try {
    await apiCall('/sales', { method: 'POST', body: JSON.stringify({ data: { medicine: currentSaleMedicine.documentId, batchNumber: batch.batch_note, quantity: qty, unitPrice: batch.sellingPrice, totalAmount: qty * batch.sellingPrice, saleDate: new Date().toISOString().slice(0,10) } }) });
    const updated = currentSaleMedicine.batch.map(b => b.batch_note === batch.batch_note ? { ...b, stock: b.stock - qty } : b);
    await apiCall(`/medicines/${currentSaleMedicine.documentId}`, { method: 'PUT', body: JSON.stringify({ data: { batch: updated } }) });
    document.getElementById('saleMessage').innerHTML = '<span class="text-green-600">✅ Sale completed! Refreshing...</span>';
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) { document.getElementById('saleMessage').innerHTML = `<span class="text-red-500">Error: ${err.message}</span>`; }
}

// ==================== SUPPLIERS ====================
let currentSuppliers = [];
async function loadSuppliers() {
  try {
    const data = await apiCall('/suppliers');
    let list = Array.isArray(data) ? data : (data.data || []);
    currentSuppliers = list.map(item => ({ id: item.id, documentId: item.documentId, ...item }));
    const isAdmin = (getUserRole() === 'admin');
    const container = document.getElementById('suppliersList');
    if (!container) return;
    let html = `<div class="data-row font-semibold bg-gray-100"><span>Name</span><span>Contact Person</span><span>Phone</span><span>Email</span><span>License</span>${isAdmin ? '<span>Actions</span>' : ''}</div>`;
    html += currentSuppliers.map(s => `<div class="data-row" data-supplier-id="${s.documentId}"><span>${escapeHtml(s.SupplierName || '')}</span><span>${escapeHtml(s.ContactPerson || '')}</span><span>${escapeHtml(s.PhoneNumber || '')}</span><span>${escapeHtml(s.EmailAddress || '')}</span><span>${escapeHtml(s.LicenseNumber || '')}</span>${isAdmin ? `<span><button class="text-blue-600 edit-supplier-btn" data-id="${s.documentId}"><i class="fas fa-edit"></i></button> <button class="text-red-600 delete-supplier-btn" data-id="${s.documentId}"><i class="fas fa-trash"></i></button></span>` : ''}</div>`).join('');
    container.innerHTML = html;
  } catch (err) { console.error(err); }
}
function openSupplierModal() { if (getUserRole() !== 'admin') { alert('Access denied'); return; } document.getElementById('supplierId').value = ''; document.getElementById('supplierForm').reset(); document.getElementById('supplierModalTitle').innerText = 'Add Supplier'; document.getElementById('supplierModal').style.display = 'flex'; }
function closeSupplierModal() { document.getElementById('supplierModal').style.display = 'none'; }
async function saveSupplier(e) {
  e.preventDefault();
  if (getUserRole() !== 'admin') { alert('Access denied'); return; }
  const id = document.getElementById('supplierId').value;
  const data = { SupplierName: document.getElementById('supplierName').value, ContactPerson: document.getElementById('contactPerson').value, PhoneNumber: document.getElementById('phone').value, EmailAddress: document.getElementById('email').value, LicenseNumber: document.getElementById('license').value };
  try {
    if (id) await apiCall(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify({ data }) });
    else await apiCall('/suppliers', { method: 'POST', body: JSON.stringify({ data }) });
    closeSupplierModal(); await loadSuppliers();
  } catch (err) { alert(err.message); }
}

// ==================== NAVBAR ====================
function loadNavbar() {
  const user = getUser(); const role = getUserRole(); const nav = document.getElementById('navbar');
  if (!nav) return;
  nav.innerHTML = `<div class="navbar"><div class="nav-links"><a href="/dashboard.html" class="${location.pathname === '/dashboard.html' ? 'active' : ''}"><i class="fas fa-tachometer-alt"></i> Dashboard</a><a href="/medicines.html" class="${location.pathname === '/medicines.html' ? 'active' : ''}"><i class="fas fa-pills"></i> Medicines</a><a href="/sales.html" class="${location.pathname === '/sales.html' ? 'active' : ''}"><i class="fas fa-cash-register"></i> Sales</a><a href="/suppliers.html" class="${location.pathname === '/suppliers.html' ? 'active' : ''}"><i class="fas fa-truck"></i> Suppliers</a></div><div class="navbar-right"><div class="profile-wrapper"><div class="profile-info" id="profileToggle"><div class="profile-details"><div class="profile-role">${role === 'admin' ? 'Admin' : 'Staff'}</div><div class="profile-name">${user?.username || 'User'}</div></div><div class="profile-avatar">${(user?.username?.charAt(0) || 'U').toUpperCase()}</div></div><div id="profileMenu" class="profile-dropdown" style="display:none;"><div class="dropdown-item" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</div></div></div></div></div>`;
  document.getElementById('profileToggle')?.addEventListener('click', () => { const m = document.getElementById('profileMenu'); if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none'; });
  document.getElementById('logoutBtn')?.addEventListener('click', () => { localStorage.removeItem('jwt'); localStorage.removeItem('user'); window.location.href = '/login.html'; });
}

// ==================== GLOBAL EVENT DELEGATION ====================
document.addEventListener('click', (e) => {
  // Close modals via close button with data-modal attribute
  const closeBtn = e.target.closest('.modal-close');
  if (closeBtn && closeBtn.dataset.modal) {
    document.getElementById(closeBtn.dataset.modal).style.display = 'none';
    if (closeBtn.dataset.modal === 'quantityModal') document.getElementById('saleMessage').innerHTML = '';
    return;
  }
  // Edit medicine button
  if (e.target.closest('.edit-medicine-btn')) {
    const btn = e.target.closest('.edit-medicine-btn');
    openEditMedicineModal(btn.dataset.id, btn.dataset.name, btn.dataset.desc, btn.dataset.type, btn.dataset.image);
  }
  // Add stock button
  if (e.target.closest('.add-stock-btn')) {
    const btn = e.target.closest('.add-stock-btn');
    openEditStockModal(btn.dataset.id, btn.dataset.name, btn.dataset.batches);
  }
  // Edit supplier (delegation)
  if (e.target.closest('.edit-supplier-btn')) {
    const btn = e.target.closest('.edit-supplier-btn');
    const id = btn.dataset.id;
    const sup = currentSuppliers.find(s => s.documentId === id);
    if (sup) {
      document.getElementById('supplierId').value = sup.documentId;
      document.getElementById('supplierName').value = sup.SupplierName || '';
      document.getElementById('contactPerson').value = sup.ContactPerson || '';
      document.getElementById('phone').value = sup.PhoneNumber || '';
      document.getElementById('email').value = sup.EmailAddress || '';
      document.getElementById('license').value = sup.LicenseNumber || '';
      document.getElementById('supplierModalTitle').innerText = 'Edit Supplier';
      document.getElementById('supplierModal').style.display = 'flex';
    }
  }
  // Delete supplier
  if (e.target.closest('.delete-supplier-btn')) {
    const btn = e.target.closest('.delete-supplier-btn');
    const id = btn.dataset.id;
    if (confirm('Delete this supplier?')) {
      apiCall(`/suppliers/${id}`, { method: 'DELETE' }).then(() => loadSuppliers()).catch(err => alert(err.message));
    }
  }
  // View All button on dashboard
  if (e.target.id === 'viewAllBtn') window.location.href = '/medicines.html';
});

// ==================== PAGE INITIALISATION ====================
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path === '/login.html') {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMsg');
        try {
          const res = await fetch(`${API_URL}/auth/local`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: email, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error.message);
          localStorage.setItem('jwt', data.jwt);
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = '/dashboard.html';
        } catch (err) {
          errorDiv.classList.remove('hidden');
          errorDiv.innerText = err.message;
        }
      });
    }
  } else {
    if (!isAuthenticated()) { window.location.href = '/login.html'; return; }
    loadNavbar();
    if (path === '/dashboard.html') loadDashboardData();
    else if (path === '/medicines.html') {
      renderMedicinesFull();
      document.getElementById('addMedicineBtn')?.addEventListener('click', () => document.getElementById('medicineModal').style.display = 'flex');
      document.getElementById('addMedicineForm')?.addEventListener('submit', addMedicine);
    } else if (path === '/sales.html') initSaleTable();
    else if (path === '/suppliers.html') {
      loadSuppliers();
      if (getUserRole() === 'admin') {
        const addBtn = document.getElementById('showAddSupplierBtn');
        if (addBtn) { addBtn.style.display = 'inline-flex'; addBtn.addEventListener('click', openSupplierModal); }
        document.getElementById('supplierForm')?.addEventListener('submit', saveSupplier);
      }
    }
  }
  // Global form listeners that are always present
  document.getElementById('addStockForm')?.addEventListener('submit', addStockToMedicine);
  document.getElementById('editMedicineForm')?.addEventListener('submit', editMedicineSubmit);
});