// app.js – shared across all pages
// @ts-nocheck

// app.js – Pharmacy Inventory System (Strapi v5)
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:1337/api'
  : 'https://sia-mela.onrender.com/api';   // <-- CHANGE THIS TO YOUR RENDER BACKEND URL

// ==================== AUTH & HELPERS ====================
function isAuthenticated() {
  return !!localStorage.getItem('jwt');
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function getUserRole() {
  const user = getUser();
  if (!user) return null;
  if (user.role && typeof user.role === 'object' && user.role.name) {
    const roleName = user.role.name.toLowerCase();
    if (roleName === 'admin') return 'admin';
    if (roleName === 'staff') return 'staff';
  }
  if (user.role && typeof user.role === 'string') {
    const roleName = user.role.toLowerCase();
    if (roleName === 'admin') return 'admin';
    if (roleName === 'staff') return 'staff';
  }
  const email = (user.email || '').toLowerCase();
  const adminEmails = ['admin-phar@gmail.com', 'admin@admin.com'];
  if (adminEmails.includes(email)) return 'admin';
  if (email.includes('admin') || email.includes('phar')) return 'admin';
  return 'staff';
}

async function apiCall(endpoint, options = {}) {
  const jwt = localStorage.getItem('jwt');
  const headers = {
    'Content-Type': 'application/json',
    ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {})
  };
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchMedicines() {
  try {
    const data = await apiCall('/medicines?populate=*');
    return data.data || [];
  } catch (err) {
    console.error('Failed to fetch medicines:', err);
    return [];
  }
}

// ==================== DASHBOARD ====================
async function loadDashboardData() {
  const medicines = await fetchMedicines();
  let totalStock = 0, lowStockCount = 0, expiredCount = 0;
  const today = new Date().toISOString().slice(0,10);
  medicines.forEach(med => {
    const batches = med.batch || [];
    batches.forEach(b => {
      totalStock += b.stock || 0;
      if (!b.is_expired && b.stock <= 5) lowStockCount++;
      if (b.expiration_date < today) expiredCount++;
    });
  });
  document.getElementById('statsCards').innerHTML = `
    <div class="stat-card"><div class="stat-info"><h3>${medicines.length}</h3><p>Medicines</p></div><div class="stat-icon"><i class="fas fa-pills"></i></div></div>
    <div class="stat-card"><div class="stat-info"><h3>${totalStock}</h3><p>Total Stock</p></div><div class="stat-icon"><i class="fas fa-boxes"></i></div></div>
    <div class="stat-card"><div class="stat-info"><h3>${lowStockCount}</h3><p>Low Stock Items</p></div><div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div></div>
    <div class="stat-card"><div class="stat-info"><h3>${expiredCount}</h3><p>Expired Batches</p></div><div class="stat-icon"><i class="fas fa-calendar-times"></i></div></div>
  `;
  const lowStockItems = [], expiredItems = [];
  medicines.forEach(med => {
    (med.batch || []).forEach(b => {
      if (!b.is_expired && b.stock <= 5) lowStockItems.push({ name: med.medicine_name, batch: b.batch_note, stock: b.stock });
      if (b.expiration_date < today) expiredItems.push({ name: med.medicine_name, batch: b.batch_note, expiry: b.expiration_date });
    });
  });
  document.getElementById('alerts').innerHTML = `
    <div class="bg-white p-5 rounded-xl shadow border-l-4 border-yellow-500"><h3 class="font-semibold text-lg"><i class="fas fa-exclamation-triangle text-yellow-500"></i> Low Stock (≤5)</h3>${lowStockItems.length ? lowStockItems.map(i => `<p class="mt-1">${i.name} (${i.batch}) – stock: ${i.stock}</p>`).join('') : '<p class="text-gray-500 mt-1">No low stock items</p>'}</div>
    <div class="bg-white p-5 rounded-xl shadow border-l-4 border-red-500"><h3 class="font-semibold text-lg"><i class="fas fa-calendar-times text-red-500"></i> Expired Medicines</h3>${expiredItems.length ? expiredItems.map(i => `<p class="mt-1">${i.name} (${i.batch}) expired on ${i.expiry}</p>`).join('') : '<p class="text-gray-500 mt-1">No expired medicines</p>'}</div>
  `;
  const recent = medicines.slice(0,5);
  document.getElementById('recentMedicinesTable').innerHTML = `
    <div class="data-row font-semibold bg-gray-100"><span>Medicine</span><span>Type</span><span>Total Stock</span></div>
    ${recent.map(med => `<div class="data-row"><span>${med.medicine_name}</span><span>${med.medicine_type || ''}</span><span>${(med.batch || []).reduce((s,b)=>s+b.stock,0)}</span></div>`).join('')}
  `;
}

// ==================== MEDICINES ====================
async function renderMedicinesFull() {
  const medicines = await fetchMedicines();
  const container = document.getElementById('medicinesList');
  const role = getUserRole();
  const canManageMedicines = (role === 'admin' || role === 'staff');
  if (!container) return;
  if (medicines.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 p-10">No medicines found. Click "Add Medicine" to create one.</div>';
    return;
  }
  container.innerHTML = medicines.map(med => {
    const medicineName = med.medicine_name || 'Unnamed';
    const description = med.medicine_desc || '';
    const medicineType = med.medicine_type || '';
    const batches = med.batch || [];
    const batchesJson = JSON.stringify(batches).replace(/"/g, '&quot;');
    return `
      <div class="border rounded-xl p-5 mb-5 bg-white shadow-sm">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-2xl font-bold">${escapeHtml(medicineName)}</h3>
            <p class="text-gray-600 mt-1">${escapeHtml(description)} | ${escapeHtml(medicineType)}</p>
          </div>
          ${canManageMedicines ? `
            <div class="flex gap-2">
              <button class="btn-sm btn-secondary" onclick="openEditMedicineModal('${med.documentId}', '${escapeHtml(medicineName)}', '${escapeHtml(description)}', '${escapeHtml(medicineType)}', '${med.is_prescription ? med.is_prescription.id : ''}')"><i class="fas fa-edit"></i> Edit</button>
              <button class="btn-sm btn-primary" onclick="openEditStockModal('${med.documentId}', '${escapeHtml(medicineName)}', \`${batchesJson}\`)"><i class="fas fa-plus-circle"></i> Add Stock</button>
            </div>
          ` : ''}
        </div>
        <table class="min-w-full mt-4 text-sm">
          <thead><tr class="bg-gray-100"><th class="p-2">Batch</th><th>Expiry</th><th>Stock</th><th>Price</th><th>Status</th></tr></thead>
          <tbody>
            ${batches.map(b => `
              <tr>
                <td class="p-2">${escapeHtml(b.batch_note || '')}</td>
                <td class="p-2">${escapeHtml(b.expiration_date || '')}</td>
                <td class="p-2">${b.stock || 0}</td>
                <td class="p-2">₱${b.sellingPrice || 0}</td>
                <td class="p-2">${b.is_expired ? '<span class="text-red-500 font-semibold">Expired</span>' : '<span class="text-green-600 font-semibold">Active</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
}

// ---------- Add Medicine ----------
async function addMedicine(e) {
  e.preventDefault();
  const medicineName = document.getElementById('medicine_name').value.trim();
  const medicineDesc = document.getElementById('medicine_desc').value.trim();
  const medicineType = document.getElementById('medicine_type').value;
  const batchNote = document.getElementById('batch_note').value.trim();
  const expiryDate = document.getElementById('expiration_date').value;
  const stock = parseInt(document.getElementById('stock').value);
  const sellingPrice = parseFloat(document.getElementById('sellingPrice').value);
  if (!medicineName) { alert('Medicine name is required'); return; }
  if (!medicineDesc) { alert('Description is required'); return; }
  if (!batchNote) { alert('Batch number is required'); return; }
  if (!expiryDate) { alert('Expiration date is required'); return; }
  if (isNaN(stock) || stock < 0) { alert('Valid stock quantity is required'); return; }
  if (isNaN(sellingPrice) || sellingPrice < 0) { alert('Valid selling price is required'); return; }
  
  const imageFile = document.getElementById('prescriptionImage').files[0];
  let prescriptionId = null;
  if (imageFile) {
    const formData = new FormData();
    formData.append('files', imageFile);
    const uploadRes = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt')}` },
      body: formData
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    const uploadData = await uploadRes.json();
    if (uploadData && uploadData[0]) prescriptionId = uploadData[0].id;
  }
  
  const batchData = {
    batch_note: batchNote,
    expiration_date: expiryDate,
    stock: stock,
    sellingPrice: sellingPrice,
    is_expired: false
  };
  const medicineData = {
    medicine_name: medicineName,
    medicine_desc: medicineDesc,
    medicine_type: medicineType,
    batch: [batchData]
  };
  if (prescriptionId) medicineData.is_prescription = prescriptionId;
  
  try {
    await apiCall('/medicines', { method: 'POST', body: JSON.stringify({ data: medicineData }) });
    alert('Medicine added successfully!');
    document.getElementById('medicineModal').style.display = 'none';
    document.getElementById('addMedicineForm').reset();
    await renderMedicinesFull();
  } catch (err) {
    console.error('Add medicine error:', err);
    alert('Failed to add medicine: ' + err.message);
  }
}

function closeMedicineModal() {
  document.getElementById('medicineModal').style.display = 'none';
}

// ---------- Edit Medicine ----------
function openEditMedicineModal(docId, name, desc, type, oldImageId) {
  document.getElementById('editMedicineId').value = docId;
  document.getElementById('edit_medicine_name').value = name;
  document.getElementById('edit_medicine_desc').value = desc;
  document.getElementById('edit_medicine_type').value = type;
  document.getElementById('edit_prescriptionImage').value = '';
  window.editOldImageId = oldImageId;
  document.getElementById('editMedicineModal').style.display = 'flex';
}

function closeEditMedicineModal() {
  document.getElementById('editMedicineModal').style.display = 'none';
}

async function editMedicineSubmit(e) {
  e.preventDefault();
  const docId = document.getElementById('editMedicineId').value;
  const newName = document.getElementById('edit_medicine_name').value;
  const newDesc = document.getElementById('edit_medicine_desc').value;
  const newType = document.getElementById('edit_medicine_type').value;
  const newImageFile = document.getElementById('edit_prescriptionImage').files[0];
  
  let prescriptionId = null;
  if (newImageFile) {
    const formData = new FormData();
    formData.append('files', newImageFile);
    const uploadRes = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt')}` },
      body: formData
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    const uploadData = await uploadRes.json();
    if (uploadData && uploadData[0]) prescriptionId = uploadData[0].id;
  }
  
  const updateData = {
    medicine_name: newName,
    medicine_desc: newDesc,
    medicine_type: newType
  };
  if (prescriptionId) updateData.is_prescription = prescriptionId;
  
  try {
    await apiCall(`/medicines/${docId}`, { method: 'PUT', body: JSON.stringify({ data: updateData }) });
    alert('Medicine updated successfully!');
    closeEditMedicineModal();
    await renderMedicinesFull();
  } catch (err) {
    console.error('Edit medicine error:', err);
    alert('Failed to update medicine: ' + err.message);
  }
}

// ---------- Add Stock ----------
let currentMedicineForStock = null;

function openEditStockModal(docId, medicineName, batchesJson) {
  currentMedicineForStock = { documentId: docId, name: medicineName, batches: JSON.parse(batchesJson) };
  document.getElementById('editMedicineIdForStock').value = docId;
  document.getElementById('editMedicineName').value = medicineName;
  
  const batchSelect = document.getElementById('existingBatchSelect');
  batchSelect.innerHTML = '<option value="new">+ Add New Batch</option>';
  currentMedicineForStock.batches.forEach(batch => {
    batchSelect.innerHTML += `<option value="${batch.batch_note}" data-expiry="${batch.expiration_date}" data-price="${batch.sellingPrice}">${batch.batch_note} (Exp: ${batch.expiration_date}, Stock: ${batch.stock}, Price: ₱${batch.sellingPrice})</option>`;
  });
  
  document.getElementById('newBatchFields').style.display = 'none';
  document.getElementById('addQuantity').value = 1;
  document.getElementById('editStockModal').style.display = 'flex';
  
  batchSelect.onchange = () => {
    if (batchSelect.value === 'new') {
      document.getElementById('newBatchFields').style.display = 'block';
    } else {
      document.getElementById('newBatchFields').style.display = 'none';
    }
  };
}

function closeEditStockModal() {
  document.getElementById('editStockModal').style.display = 'none';
  currentMedicineForStock = null;
}

async function addStockToMedicine(e) {
  e.preventDefault();
  const docId = document.getElementById('editMedicineIdForStock').value;
  const addQty = parseInt(document.getElementById('addQuantity').value);
  const batchSelect = document.getElementById('existingBatchSelect');
  const selectedValue = batchSelect.value;
  
  if (!currentMedicineForStock || isNaN(addQty) || addQty <= 0) {
    alert('Please enter a valid quantity');
    return;
  }
  
  let updatedBatches = [...currentMedicineForStock.batches];
  
  if (selectedValue === 'new') {
    const newBatchNote = document.getElementById('newBatchNote').value.trim();
    const newExpiry = document.getElementById('newExpirationDate').value;
    const newPrice = parseFloat(document.getElementById('newSellingPrice').value);
    if (!newBatchNote) { alert('New batch number is required'); return; }
    if (!newExpiry) { alert('Expiration date is required for new batch'); return; }
    if (isNaN(newPrice) || newPrice <= 0) { alert('Valid selling price is required'); return; }
    updatedBatches.push({
      batch_note: newBatchNote,
      expiration_date: newExpiry,
      stock: addQty,
      sellingPrice: newPrice,
      is_expired: false
    });
  } else {
    updatedBatches = updatedBatches.map(b => {
      if (b.batch_note === selectedValue) {
        return { ...b, stock: b.stock + addQty };
      }
      return b;
    });
  }
  
  try {
    await apiCall(`/medicines/${docId}`, {
      method: 'PUT',
      body: JSON.stringify({ data: { batch: updatedBatches } })
    });
    alert('Stock added successfully!');
    closeEditStockModal();
    await renderMedicinesFull();
  } catch (err) {
    console.error('Error adding stock:', err);
    alert('Failed to add stock: ' + err.message);
  }
}

// ==================== SALES ====================
let currentSelectedMedicine = null;
let currentSelectedBatch = null;

async function initSaleTable() {
  const medicines = await fetchMedicines();
  const available = medicines.filter(m => (m.batch || []).some(b => !b.is_expired && b.stock > 0));
  const medicineSelect = document.getElementById('medicineSelect');
  if (!medicineSelect) return;
  
  medicineSelect.innerHTML = '<option value="">Select medicine</option>' + 
    available.map(m => `<option value="${m.documentId}">${m.medicine_name}</option>`).join('');
  
  medicineSelect.addEventListener('change', async () => {
    const docId = medicineSelect.value;
    if (!docId) {
      document.getElementById('batchTableContainer').style.display = 'none';
      return;
    }
    currentSelectedMedicine = available.find(m => m.documentId === docId);
    renderBatchTable(currentSelectedMedicine);
  });
}

function renderBatchTable(medicine) {
  const batches = medicine.batch.filter(b => !b.is_expired && b.stock > 0);
  const container = document.getElementById('batchTable');
  const tableContainer = document.getElementById('batchTableContainer');
  
  if (batches.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 p-4">No active batches available.</div>';
    tableContainer.style.display = 'block';
    return;
  }
  
  let html = `
    <table class="min-w-full bg-white border rounded-lg overflow-hidden">
      <thead class="bg-gray-100">
        <tr><th class="p-2 border">Batch Number</th><th class="p-2 border">Expiry Date</th><th class="p-2 border">Stock</th><th class="p-2 border">Price</th><th class="p-2 border">Action</th></tr></thead>
      <tbody>
  `;
  
  batches.forEach(batch => {
    html += `
      <tr class="hover:bg-gray-50">
        <td class="p-2 border text-center">${escapeHtml(batch.batch_note)}</td>
        <td class="p-2 border text-center">${escapeHtml(batch.expiration_date)}</td>
        <td class="p-2 border text-center">${batch.stock}</td>
        <td class="p-2 border text-center">₱${batch.sellingPrice}</td>
        <td class="p-2 border text-center"><button class="btn-sm btn-primary sell-btn" data-batch='${JSON.stringify(batch).replace(/'/g, "&#39;")}'>Sell</button></td>
      </tr>
    `;
  });
  
  html += `</tbody></table>`;
  container.innerHTML = html;
  tableContainer.style.display = 'block';
  
  document.querySelectorAll('.sell-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const batchData = JSON.parse(btn.getAttribute('data-batch'));
      currentSelectedBatch = batchData;
      openQuantityModal(batchData);
    });
  });
}

function openQuantityModal(batch) {
  document.getElementById('selectedBatchInfo').innerHTML = `Batch: ${batch.batch_note}<br>Price: ₱${batch.sellingPrice}<br>Max stock: ${batch.stock}`;
  document.getElementById('saleQuantity').value = 1;
  document.getElementById('saleQuantity').max = batch.stock;
  document.getElementById('saleTotal').innerHTML = `Total: ₱${batch.sellingPrice}`;
  document.getElementById('quantityModal').style.display = 'flex';
  
  const quantityInput = document.getElementById('saleQuantity');
  quantityInput.oninput = () => {
    const qty = parseInt(quantityInput.value) || 0;
    document.getElementById('saleTotal').innerHTML = `Total: ₱${(qty * batch.sellingPrice).toFixed(2)}`;
  };
  
  const confirmBtn = document.getElementById('confirmSaleBtn');
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  newConfirmBtn.addEventListener('click', async () => {
    await completeSale(batch);
  });
}

function closeQuantityModal() {
  document.getElementById('quantityModal').style.display = 'none';
  document.getElementById('saleMessage').innerHTML = '';
}

async function completeSale(batch) {
  const qty = parseInt(document.getElementById('saleQuantity').value);
  if (isNaN(qty) || qty <= 0 || qty > batch.stock) {
    document.getElementById('saleMessage').innerHTML = '<span class="text-red-500">Invalid quantity</span>';
    return;
  }
  
  try {
    await apiCall('/sales', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          medicine: currentSelectedMedicine.documentId,
          batchNumber: batch.batch_note,
          quantity: qty,
          unitPrice: batch.sellingPrice,
          totalAmount: qty * batch.sellingPrice,
          saleDate: new Date().toISOString().slice(0,10)
        }
      })
    });
    
    const updatedBatches = currentSelectedMedicine.batch.map(b => 
      b.batch_note === batch.batch_note ? { ...b, stock: b.stock - qty } : b
    );
    await apiCall(`/medicines/${currentSelectedMedicine.documentId}`, {
      method: 'PUT',
      body: JSON.stringify({ data: { batch: updatedBatches } })
    });
    
    document.getElementById('saleMessage').innerHTML = '<span class="text-green-600">✅ Sale completed! Refreshing...</span>';
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    console.error('Sale error:', err);
    document.getElementById('saleMessage').innerHTML = `<span class="text-red-500">Error: ${err.message}</span>`;
  }
}

// ==================== SUPPLIERS ====================
let currentSuppliers = [];

async function loadSuppliers() {
  try {
    const data = await apiCall('/suppliers');
    let suppliersList = Array.isArray(data) ? data : (data.data || []);
    currentSuppliers = suppliersList.map(item => {
      return { id: item.id, documentId: item.documentId, ...item };
    });
    const role = getUserRole();
    const isAdmin = (role === 'admin');
    const container = document.getElementById('suppliersList');
    if (!container) return;
    
    let rowsHtml = `
      <div class="data-row font-semibold bg-gray-100">
        <span>Name</span><span>Contact Person</span><span>Phone</span><span>Email</span><span>License</span>
        ${isAdmin ? '<span>Actions</span>' : ''}
      </div>
    `;
    rowsHtml += currentSuppliers.map(s => `
      <div class="data-row">
        <span>${escapeHtml(s.SupplierName || '')}</span>
        <span>${escapeHtml(s.ContactPerson || '')}</span>
        <span>${escapeHtml(s.PhoneNumber || '')}</span>
        <span>${escapeHtml(s.EmailAddress || '')}</span>
        <span>${escapeHtml(s.LicenseNumber || '')}</span>
        ${isAdmin ? `
          <span>
            <button class="text-blue-600" onclick="editSupplier('${s.documentId}')"><i class="fas fa-edit"></i></button>
          </span>
        ` : ''}
      </div>
    `).join('');
    container.innerHTML = rowsHtml;
    
    if (isAdmin) {
      window.editSupplier = (docId) => {
        const sup = currentSuppliers.find(s => s.documentId === docId);
        if (!sup) return;
        document.getElementById('supplierId').value = sup.documentId;
        document.getElementById('supplierName').value = sup.SupplierName || '';
        document.getElementById('contactPerson').value = sup.ContactPerson || '';
        document.getElementById('phone').value = sup.PhoneNumber || '';
        document.getElementById('email').value = sup.EmailAddress || '';
        document.getElementById('license').value = sup.LicenseNumber || '';
        document.getElementById('supplierModalTitle').innerText = 'Edit Supplier';
        document.getElementById('supplierModal').style.display = 'flex';
      };
      // deleteSupplier function removed
    } else {
      window.editSupplier = undefined;
    }
  } catch (err) {
    console.error('Failed to load suppliers:', err);
  }
}

function openSupplierModal() {
  const role = getUserRole();
  if (role !== 'admin') {
    alert('Access denied: Only admin can manage suppliers.');
    return;
  }
  document.getElementById('supplierId').value = '';
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierModalTitle').innerText = 'Add Supplier';
  document.getElementById('supplierModal').style.display = 'flex';
}

function closeSupplierModal() {
  document.getElementById('supplierModal').style.display = 'none';
}

async function saveSupplier(e) {
  e.preventDefault();
  const role = getUserRole();
  if (role !== 'admin') {
    alert('Access denied: Only admin can modify suppliers.');
    return;
  }
  const docId = document.getElementById('supplierId').value;
  const data = {
    SupplierName: document.getElementById('supplierName').value,
    ContactPerson: document.getElementById('contactPerson').value,
    PhoneNumber: document.getElementById('phone').value,
    EmailAddress: document.getElementById('email').value,
    LicenseNumber: document.getElementById('license').value
  };
  try {
    if (docId) {
      await apiCall(`/suppliers/${docId}`, { method: 'PUT', body: JSON.stringify({ data }) });
    } else {
      await apiCall('/suppliers', { method: 'POST', body: JSON.stringify({ data }) });
    }
    closeSupplierModal();
    await loadSuppliers();
  } catch (err) {
    console.error('Save supplier error:', err);
    alert('Error saving supplier: ' + err.message);
  }
}

// ==================== NAVBAR ====================
function loadNavbar() {
  const user = getUser();
  const role = getUserRole();
  const nav = document.getElementById('navbar');
  if (!nav) return;
  nav.innerHTML = `
    <div class="navbar">
      <div class="nav-links">
        <a href="/dashboard.html" class="${window.location.pathname === '/dashboard.html' ? 'active' : ''}"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
        <a href="/medicines.html" class="${window.location.pathname === '/medicines.html' ? 'active' : ''}"><i class="fas fa-pills"></i> Medicines</a>
        <a href="/sales.html" class="${window.location.pathname === '/sales.html' ? 'active' : ''}"><i class="fas fa-cash-register"></i> Sales</a>
        <a href="/suppliers.html" class="${window.location.pathname === '/suppliers.html' ? 'active' : ''}"><i class="fas fa-truck"></i> Suppliers</a>
      </div>
      <div class="navbar-right">
        <div class="profile-wrapper">
          <div class="profile-info" onclick="toggleProfileMenu()">
            <div class="profile-details"><div class="profile-role">${role === 'admin' ? 'Admin' : 'Staff'}</div><div class="profile-name">${user?.username || 'User'}</div></div>
            <div class="profile-avatar">${(user?.username?.charAt(0) || 'U').toUpperCase()}</div>
          </div>
          <div id="profileMenu" class="profile-dropdown" style="display:none;">
            <div class="dropdown-item" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.toggleProfileMenu = () => {
  const menu = document.getElementById('profileMenu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};

window.logout = () => {
  localStorage.removeItem('jwt');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  const addStockForm = document.getElementById('addStockForm');
  if (addStockForm) addStockForm.addEventListener('submit', addStockToMedicine);
  const editMedicineForm = document.getElementById('editMedicineForm');
  if (editMedicineForm) editMedicineForm.addEventListener('submit', editMedicineSubmit);
});

// Global exports
window.openEditMedicineModal = openEditMedicineModal;
window.closeEditMedicineModal = closeEditMedicineModal;
window.openEditStockModal = openEditStockModal;
window.closeEditStockModal = closeEditStockModal;
window.openSupplierModal = openSupplierModal;
window.closeSupplierModal = closeSupplierModal;
window.saveSupplier = saveSupplier;
window.addMedicine = addMedicine;
window.closeMedicineModal = closeMedicineModal;
window.initSaleTable = initSaleTable;
window.loadSuppliers = loadSuppliers;
window.loadDashboardData = loadDashboardData;
window.renderMedicinesFull = renderMedicinesFull;