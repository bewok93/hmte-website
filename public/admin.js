const API_URL = '/api';
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        const authContainer = document.getElementById('authContainer');
        const dashboardContainer = document.getElementById('dashboardContainer');
        if (authContainer) authContainer.classList.add('hidden');
        if (dashboardContainer) dashboardContainer.classList.remove('hidden');
        loadAdminData();
    }
});

// Handle Login Admin
const formSignIn = document.getElementById('formSignIn');
if (formSignIn) {
    formSignIn.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;

        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.token) {
            localStorage.setItem('token', data.token);
            location.reload();
        } else {
            alert(data.message || 'Login gagal.');
        }
    });
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
}

function loadAdminData() {
    loadAdminPengurus();
    loadAdminProduk();
    loadAdminAnggota();
    loadAdminKegiatan();
    loadAdminKas();
}

// ================= 1. PENGURUS =================
async function loadAdminPengurus() {
    const res = await fetch(`${API_URL}/admin/daftar-pengurus`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const tbody = document.getElementById('tabelAdminPengurus');
    if (!tbody) return;

    tbody.innerHTML = data.map(p => `
        <tr>
            <td class="p-3 font-semibold text-indigo-400">${p.jabatan || '-'}</td>
            <td class="p-3">${p.nama}</td>
            <td class="p-3">${p.email}</td>
            <td class="p-3 font-semibold ${p.status === 'aktif' ? 'text-emerald-400' : 'text-rose-400'}">${(p.status || 'aktif').toUpperCase()}</td>
            <td class="p-3">
                <button onclick="toggleStatusPengurus('${p.id}', '${p.status || 'aktif'}')" class="bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white px-3 py-1 rounded-lg text-xs transition">
                    ${p.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
            </td>
        </tr>
    `).join('');
}

const formTambahPengurus = document.getElementById('formTambahPengurus');
if (formTambahPengurus) {
    formTambahPengurus.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nim = document.getElementById('pengurusNim').value;
        const nama = document.getElementById('pengurusNama').value;
        const jabatan = document.getElementById('pengurusJabatan').value;
        const email = document.getElementById('pengurusEmail').value;
        const password = document.getElementById('pengurusPassword').value;

        const res = await fetch(`${API_URL}/admin/tambah-pengurus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nim, nama, jabatan, email, password })
        });
        const data = await res.json();
        alert(data.message);
        if (res.ok) {
            e.target.reset();
            loadAdminPengurus();
        }
    });
}

async function toggleStatusPengurus(id, currentStatus) {
    const newStatus = currentStatus === 'aktif' ? 'tidak_aktif' : 'aktif';
    const res = await fetch(`${API_URL}/admin/pengurus/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    alert(data.message);
    loadAdminPengurus();
}

// ================= 2. PRODUK =================
async function loadAdminProduk() {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    const tbody = document.getElementById('tabelAdminProduk');
    if (!tbody) return;

    tbody.innerHTML = data.map(p => `
        <tr>
            <td class="p-3">${p.gambar ? `<img src="${p.gambar}" class="w-12 h-12 object-cover rounded-xl border border-gray-700">` : '-'}</td>
            <td class="p-3 font-semibold text-white">${p.nama_produk}</td>
            <td class="p-3">Rp ${Number(p.harga || 0).toLocaleString()}</td>
            <td class="p-3 font-bold text-emerald-400">${p.stok}</td>
            <td class="p-3 space-x-2">
                <button onclick="ubahStok('${p.id}', ${p.stok})" class="bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white px-2.5 py-1 rounded-lg text-xs transition">Atur Stok</button>
                <button onclick="hapusProduk('${p.id}')" class="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-2.5 py-1 rounded-lg text-xs transition">Hapus</button>
            </td>
        </tr>
    `).join('');
}

async function ubahStok(id, currentStok) {
    const newStok = prompt("Masukkan jumlah stok baru:", currentStok);
    if (newStok === null) return;
    const res = await fetch(`${API_URL}/admin/products/${id}/stok`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ stok: newStok })
    });
    const data = await res.json();
    alert(data.message);
    loadAdminProduk();
}

async function hapusProduk(id) {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;
    await fetch(`${API_URL}/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadAdminProduk();
}

const formProduk = document.getElementById('formProduk');
if (formProduk) {
    formProduk.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('nama_produk', document.getElementById('namaProduk').value);
        formData.append('harga', document.getElementById('hargaProduk').value);
        formData.append('stok', document.getElementById('stokProduk').value);
        formData.append('deskripsi', document.getElementById('deskProduk').value);
        
        const gambarFile = document.getElementById('gambarProduk').files[0];
        if (gambarFile) formData.append('gambar', gambarFile);

        const res = await fetch(`${API_URL}/admin/products`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        alert(data.message);
        e.target.reset();
        loadAdminProduk();
    });
}

// ================= 3. ANGGOTA HMTE =================
async function loadAdminAnggota() {
    const res = await fetch(`${API_URL}/anggota`);
    const result = await res.json();
    const data = result.success ? result.data : (Array.isArray(result) ? result : []);
    const tbody = document.getElementById('tabelAdminAnggota');
    if (!tbody) return;

    tbody.innerHTML = data.map(a => {
        const isAktif = (!a.status || a.status === 'aktif');
        return `
            <tr>
                <td class="p-3">${a.nim}</td>
                <td class="p-3">${a.nama}</td>
                <td class="p-3">${a.email || '-'}</td>
                <td class="p-3 font-semibold ${isAktif ? 'text-emerald-400' : 'text-rose-400'}">${isAktif ? 'AKTIF' : 'NONAKTIF'}</td>
                <td class="p-3 space-x-2">
                    <button onclick="toggleStatusAnggota('${a.id}', '${isAktif ? 'nonaktif' : 'aktif'}')" class="bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white px-2.5 py-1 rounded-lg text-xs transition">
                        ${isAktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onclick="hapusAnggota('${a.id}')" class="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-2.5 py-1 rounded-lg text-xs transition">Hapus</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleStatusAnggota(id, currentStatus) {
    const newStatus = currentStatus === 'aktif' ? 'nonaktif' : 'aktif';
    await fetch(`${API_URL}/admin/anggota/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
    });
    loadAdminAnggota();
}

async function hapusAnggota(id) {
    if (!confirm('Yakin ingin menghapus anggota ini?')) return;
    await fetch(`${API_URL}/admin/anggota/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadAdminAnggota();
}

const formTambahAnggota = document.getElementById('formTambahAnggota');
if (formTambahAnggota) {
    formTambahAnggota.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nim = document.getElementById('nimAnggota').value;
        const nama = document.getElementById('namaAnggota').value;
        const email = document.getElementById('emailAnggota').value;

        const res = await fetch(`${API_URL}/admin/anggota`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nim, nama, email })
        });
        const data = await res.json();
        alert(data.message);
        if (res.ok) {
            e.target.reset();
            loadAdminAnggota();
        }
    });
}

// ================= 4. KEGIATAN =================
async function loadAdminKegiatan() {
    const res = await fetch(`${API_URL}/kegiatan`);
    const data = await res.json();
    const tbody = document.getElementById('tabelAdminKegiatan');
    if (!tbody) return;

    tbody.innerHTML = data.map(k => `
        <tr>
            <td class="p-3 text-gray-400">${k.tanggal}</td>
            <td class="p-3">${k.judul}</td>
            <td class="p-3">
                <button onclick="hapusKegiatan('${k.id}')" class="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-2.5 py-1 rounded-lg text-xs transition">Hapus</button>
            </td>
        </tr>
    `).join('');
}

async function hapusKegiatan(id) {
    if (!confirm('Yakin ingin menghapus kegiatan ini?')) return;
    await fetch(`${API_URL}/admin/kegiatan/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadAdminKegiatan();
}

const formKegiatan = document.getElementById('formKegiatan');
if (formKegiatan) {
    formKegiatan.addEventListener('submit', async (e) => {
        e.preventDefault();
        const judul = document.getElementById('judulKegiatan').value;
        const tanggal = document.getElementById('tglKegiatan').value;
        const deskripsi = document.getElementById('deskKegiatan').value;
        const poinRaw = document.getElementById('poinInformasi').value;
        const poin_informasi = poinRaw ? poinRaw.split(',').map(s => s.trim()) : [];

        const res = await fetch(`${API_URL}/admin/kegiatan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ judul, tanggal, deskripsi, poin_informasi })
        });
        const data = await res.json();
        alert(data.message);
        e.target.reset();
        loadAdminKegiatan();
    });
}

// ================= 5. UANG KAS =================
async function loadAdminKas() {
    const res = await fetch(`${API_URL}/uang-kas`);
    const data = await res.json();
    const tbody = document.getElementById('tabelAdminKas');
    if (!tbody) return;

    tbody.innerHTML = data.map(k => `
        <tr>
            <td class="p-3 text-gray-400">${k.tanggal}</td>
            <td class="p-3 font-semibold ${k.jenis === 'masuk' ? 'text-emerald-400' : 'text-red-400'}">${(k.jenis || 'masuk').toUpperCase()} (Rp ${Number(k.jumlah || 0).toLocaleString()})</td>
            <td class="p-3">
                <button onclick="hapusKas('${k.id}')" class="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-2.5 py-1 rounded-lg text-xs transition">Hapus</button>
            </td>
        </tr>
    `).join('');
}

async function hapusKas(id) {
    if (!confirm('Yakin ingin menghapus transaksi kas ini?')) return;
    await fetch(`${API_URL}/admin/uang-kas/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadAdminKas();
}

const formKas = document.getElementById('formKas');
if (formKas) {
    formKas.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('tanggal', document.getElementById('tglKas').value);
        formData.append('jenis', document.getElementById('jenisKas').value);
        formData.append('jumlah', document.getElementById('jumlahKas').value);
        formData.append('keterangan', document.getElementById('ketKas').value);
        
        const notaFile = document.getElementById('notaKas').files[0];
        if (notaFile) formData.append('nota', notaFile);

        const res = await fetch(`${API_URL}/admin/uang-kas`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        alert(data.message);
        e.target.reset();
        loadAdminKas();
    });
}

// ================= 6. UBAH PASSWORD =================
const formPassword = document.getElementById('formPassword');
if (formPassword) {
    formPassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password_lama = document.getElementById('passLama').value;
        const password_baru = document.getElementById('passBaru').value;

        const res = await fetch(`${API_URL}/admin/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password_lama, password_baru })
        });
        const data = await res.json();
        alert(data.message);
        if (res.ok) e.target.reset();
    });
}