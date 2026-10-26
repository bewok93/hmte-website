const API_URL = '/api';

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function showSection(sectionId) {
    document.getElementById('section-profil').classList.add('hidden');
    document.getElementById('section-anggota').classList.add('hidden');
    document.getElementById('section-kegiatan').classList.add('hidden');
    document.getElementById('section-produk').classList.add('hidden');
    document.getElementById('section-keuangan').classList.add('hidden');

    document.getElementById(`section-${sectionId}`).classList.remove('hidden');
    toggleSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadKegiatan() {
    const res = await fetch(`${API_URL}/kegiatan`);
    const data = await res.json();
    document.getElementById('listKegiatan').innerHTML = data.length ? data.map(k => `
        <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-4 hover:shadow-md transition">
            <span class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">${k.tanggal}</span>
            <h3 class="font-black text-xl text-slate-900">${k.judul}</h3>
            <p class="text-slate-600 text-sm leading-relaxed">${k.deskripsi}</p>
            ${k.poin_informasi ? `<div class="text-xs bg-slate-50 text-slate-700 p-3 rounded-2xl font-medium border border-slate-100">Info: ${JSON.parse(k.poin_informasi).join(', ')}</div>` : ''}
        </div>
    `).join('') : '<p class="text-slate-500 text-sm col-span-2 text-center py-10">Belum ada informasi kegiatan yang dipublikasikan.</p>';
}

async function loadProduk() {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    document.getElementById('listProduk').innerHTML = data.length ? data.map(p => `
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 space-y-4 flex flex-col justify-between">
            <div>
                ${p.gambar ? `<img src="${p.gambar}" alt="${p.nama_produk}" class="w-full h-48 object-cover rounded-2xl mb-4 border border-slate-100">` : ''}
                <h3 class="font-black text-lg text-slate-900">${p.nama_produk}</h3>
                <p class="text-slate-600 text-xs mt-1 leading-relaxed">${p.deskripsi || '-'}</p>
            </div>
            <div class="space-y-3 pt-4 border-t border-slate-100">
                <div class="flex justify-between items-center">
                    <span class="font-black text-blue-600 text-base">Rp ${p.harga.toLocaleString()}</span>
                    <span class="text-xs px-3 py-1 rounded-full font-bold ${p.stok > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                        Stok: ${p.stok}
                    </span>
                </div>
            </div>
        </div>
    `).join('') : '<p class="text-slate-500 text-sm col-span-3 text-center py-10">Belum ada produk merchandise yang tersedia.</p>';
}

async function loadKas() {
    const bulan = document.getElementById('filterBulan')?.value || '';
    const url = bulan ? `${API_URL}/uang-kas?month=${bulan}` : `${API_URL}/uang-kas`;
    const res = await fetch(url);
    const data = await res.json();
    document.getElementById('tabelKas').innerHTML = data.length ? data.map(k => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-4 text-slate-600">${k.tanggal}</td>
            <td class="p-4 font-extrabold ${k.jenis === 'masuk' ? 'text-emerald-600' : 'text-rose-600'}">${k.jenis.toUpperCase()}</td>
            <td class="p-4 font-bold text-slate-900">Rp ${k.jumlah.toLocaleString()}</td>
            <td class="p-4">${k.bukti_nota ? `<a href="${k.bukti_nota}" target="_blank" class="text-blue-600 hover:underline font-bold">Lihat Nota</a>` : '-'}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="p-4 text-center text-slate-500 text-sm">Tidak ada transaksi pada bulan ini.</td></tr>';
}

function resetFilterBulan() {
    const filterInput = document.getElementById('filterBulan');
    if (filterInput) filterInput.value = '';
    loadKas();
}

async function cariAnggota() {
    const keyword = document.getElementById('inputCariAnggota').value.trim();
    const div = document.getElementById('resultAnggota');
    if (!keyword) {
        div.innerHTML = '<p class="text-sm text-slate-500 italic">Silakan masukkan NIM atau Nama terlebih dahulu.</p>';
        return;
    }
    const res = await fetch(`${API_URL}/anggota/search?q=${encodeURIComponent(keyword)}`);
    const data = await res.json();
    if (res.ok && data.length > 0) {
        div.innerHTML = data.map(a => `
            <div class="p-6 rounded-2xl border ${a.status === 'aktif' ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950' : 'bg-rose-50/50 border-rose-200 text-rose-950'} flex justify-between items-center shadow-xs">
                <div class="space-y-1">
                    <p class="text-xs font-bold uppercase tracking-wider text-slate-400">NIM: ${a.nim}</p>
                    <h4 class="text-lg font-black">${a.nama}</h4>
                </div>
                <div>
                    <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${a.status === 'aktif' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}">
                        ${a.status}
                    </span>
                </div>
            </div>
        `).join('');
    } else {
        div.innerHTML = '<div class="p-6 rounded-2xl text-sm bg-slate-100 text-slate-600 border border-slate-200 text-center font-medium">Data anggota tidak ditemukan dalam database organisasi.</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadKegiatan();
    loadProduk();
    loadKas();
});