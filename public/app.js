const API_URL = '/api';
let globalDataKas = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM siap, memuat data publik...");
    loadPublicKegiatan();
    loadPublicProduk();
    loadPublicKas();
});

// ================= 1. NAVIGASI & SIDEBAR =================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    }
}

function showSection(sectionId) {
    const sections = ['profil', 'anggota', 'kegiatan', 'produk', 'keuangan'];
    sections.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if (el) el.classList.add('hidden');
    });
    
    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.remove('hidden');
    toggleSidebar();
}


// ================= 2. PENCARIAN & VERIFIKASI ANGGOTA =================
async function cariAnggota() {
    const keyword = document.getElementById('inputCariAnggota')?.value.toLowerCase() || '';
    const container = document.getElementById('hasilCariAnggota');
    
    if (!container) {
        console.error("Elemen ID 'hasilCariAnggota' tidak ditemukan di index.html!");
        return;
    }

    if (!keyword) {
        container.innerHTML = `<p class="text-gray-400 text-sm">Masukkan Nama atau NIM untuk mencari anggota.</p>`;
        return;
    }

    try {
        const res = await fetch(`${API_URL}/anggota`);
        const result = await res.json();
        const data = result.success ? result.data : (Array.isArray(result) ? result : []);

        const filtered = data.filter(a => 
            (a.nama && a.nama.toLowerCase().includes(keyword)) || 
            (a.nim && a.nim.toLowerCase().includes(keyword))
        );

        if (filtered.length > 0) {
            container.innerHTML = filtered.map(a => {
                const isAktif = (!a.status || a.status === 'aktif');
                return `
                    <div class="bg-[#121826] border border-gray-800 p-4 rounded-xl flex justify-between items-center mb-3">
                        <div>
                            <h4 class="font-bold text-white">${a.nama}</h4>
                            <p class="text-sm text-gray-400">NIM: ${a.nim} | Email: ${a.email || '-'}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${isAktif ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                            ${isAktif ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `<p class="text-gray-400 text-sm">Anggota dengan kata kunci tersebut tidak ditemukan.</p>`;
        }
    } catch (error) {
        console.error('Gagal mencari anggota:', error);
    }
}


// ================= 3. MENAMPILKAN INFORMASI KEGIATAN =================
async function loadPublicKegiatan() {
    try {
        const res = await fetch(`${API_URL}/kegiatan`);
        const data = await res.json();
        console.log("Data Kegiatan diterima:", data);
        
        const container = document.getElementById('containerKegiatanPublic');
        if (!container) {
            console.error("Elemen ID 'containerKegiatanPublic' tidak ditemukan di index.html!");
            return;
        }

        if (Array.isArray(data) && data.length > 0) {
            container.innerHTML = data.map(k => `
                <div class="bg-[#121826] border border-gray-800 p-6 rounded-2xl space-y-3">
                    <span class="text-xs text-indigo-400 font-semibold">${k.tanggal || '-'}</span>
                    <h3 class="text-xl font-bold text-white">${k.judul}</h3>
                    <p class="text-sm text-gray-300">${k.deskripsi || ''}</p>
                </div>
            `).join('');
        } else {
            container.innerHTML = `<p class="text-gray-400 text-sm">Belum ada informasi kegiatan terbaru.</p>`;
        }
    } catch (error) {
        console.error('Gagal memuat kegiatan:', error);
    }
}


// ================= 4. MENAMPILKAN & MEMESAN MERCHANDISE =================
async function loadPublicProduk() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const data = await res.json();
        console.log("Data Produk diterima:", data);

        const container = document.getElementById('containerProdukPublic');
        if (!container) {
            console.error("Elemen ID 'containerProdukPublic' tidak ditemukan di index.html!");
            return;
        }

        if (Array.isArray(data) && data.length > 0) {
            container.innerHTML = data.map(p => `
                <div class="bg-[#121826] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between hover:border-gray-700 transition">
                    <div>
                        <div class="w-full h-44 bg-gray-900 rounded-xl mb-3 overflow-hidden flex items-center justify-center border border-gray-800">
                            ${p.gambar ? `<img src="${p.gambar}" class="w-full h-full object-contain">` : '<span class="text-xs text-gray-500">No Image</span>'}
                        </div>
                        <h3 class="font-bold text-white text-base mb-1">${p.nama_produk}</h3>
                        <p class="text-emerald-400 font-semibold text-sm">Rp ${Number(p.harga || 0).toLocaleString('id-ID')}</p>
                        <p class="text-xs text-gray-400 mt-1">Stok Tersedia: <span class="font-medium text-white">${p.stok}</span></p>
                    </div>
                    <button onclick="beliProduk('${p.nama_produk}', ${p.harga})" class="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-semibold transition shadow-lg shadow-indigo-600/20">
                        Pesan via WhatsApp
                    </button>
                </div>
            `).join('');
        } else {
            container.innerHTML = `<p class="text-gray-400 text-sm col-span-full text-center py-6">Belum ada merchandise yang tersedia.</p>`;
        }
    } catch (error) {
        console.error('Gagal memuat produk:', error);
    }
}

function beliProduk(namaProduk, harga) {
    const nomorWhatsAppAdmin = "6289509410912";
    const pesan = `Halo Kak, saya ingin memesan merchandise HMTE: *${namaProduk}* seharga Rp ${Number(harga).toLocaleString('id-ID')}. Mohon informasi selanjutnya.`;
    window.open(`https://wa.me/${nomorWhatsAppAdmin}?text=${encodeURIComponent(pesan)}`, '_blank');
}


// ================= 5. LAPORAN UANG KAS & FILTER PERIODE =================
async function loadPublicKas() {
    try {
        const res = await fetch(`${API_URL}/uang-kas`);
        const data = await res.json();
        globalDataKas = Array.isArray(data) ? data : [];
        renderKas(globalDataKas);
    } catch (error) {
        console.error('Gagal memuat data kas:', error);
    }
}

function renderKas(data) {
    const container = document.getElementById('containerKasPublic');
    if (!container) return;

    if (data.length > 0) {
        container.innerHTML = data.map(k => `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition">
                <td class="p-3 text-gray-300 text-sm">${k.tanggal || '-'}</td>
                <td class="p-3 font-semibold text-sm ${k.jenis === 'masuk' ? 'text-emerald-400' : 'text-rose-400'}">${(k.jenis || 'masuk').toUpperCase()}</td>
                <td class="p-3 font-bold text-white text-sm">Rp ${Number(k.jumlah || 0).toLocaleString('id-ID')}</td>
                <td class="p-3 text-gray-300 text-sm">${k.keterangan || '-'}</td>
            </tr>
        `).join('');
    } else {
        container.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 text-sm">Tidak ada transaksi pada periode ini.</td></tr>`;
    }
}

function filterKas() {
    const tipeFilter = document.getElementById('filterPeriode').value;
    const now = new Date();

    const filtered = globalDataKas.filter(k => {
        if (!k.tanggal) return false;
        const tglTransaksi = new Date(k.tanggal);

        if (tipeFilter === 'bulan') {
            return tglTransaksi.getMonth() === now.getMonth() && tglTransaksi.getFullYear() === now.getFullYear();
        } else if (tipeFilter === 'minggu') {
            const selisihHari = (now - tglTransaksi) / (1000 * 60 * 60 * 24);
            return selisihHari >= 0 && selisihHari <= 7;
        }
        return true;
    });

    renderKas(filtered);
}