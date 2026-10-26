require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const db = new sqlite3.Database('./database.db', (err) => {
    if (!err) console.log('Database SQLite connected.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nim TEXT UNIQUE,
        nama TEXT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'anggota',
        jabatan TEXT DEFAULT 'Anggota',
        status TEXT DEFAULT 'aktif'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS kegiatan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        judul TEXT,
        deskripsi TEXT,
        tanggal TEXT,
        poin_informasi TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS uang_kas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal TEXT,
        jenis TEXT,
        jumlah REAL,
        keterangan TEXT,
        bukti_nota TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_produk TEXT,
        deskripsi TEXT,
        harga REAL,
        stok INTEGER,
        gambar TEXT
    )`);

    // Default Akun Ketua Himpunan
    db.get(`SELECT * FROM users WHERE email = 'ketua@hmte.or.id'`, async (err, row) => {
        if (!row) {
            const hash = await bcrypt.hash('ketua123', 10);
            db.run(`INSERT INTO users (nim, nama, email, password, role, jabatan, status) VALUES ('KHD01', 'Ketua Himpunan Elektro', 'ketua@hmte.or.id', ?, 'admin', 'Ketua Himpunan', 'aktif')`, [hash]);
        }
    });

    // Default Akun Sekretaris Himpunan
    db.get(`SELECT * FROM users WHERE email = 'sekretaris@hmte.or.id'`, async (err, row) => {
        if (!row) {
            const hash = await bcrypt.hash('sekretaris123', 10);
            db.run(`INSERT INTO users (nim, nama, email, password, role, jabatan, status) VALUES ('SKR01', 'Sekretaris Himpunan Elektro', 'sekretaris@hmte.or.id', ?, 'admin', 'Sekretaris Himpunan', 'aktif')`, [hash]);
        }
    });

    // Default Akun Bendahara Himpunan
    db.get(`SELECT * FROM users WHERE email = 'Bendahara@hmte.or.id'`, async (err, row) => {
        if (!row) {
            const hash = await bcrypt.hash('bendahara123', 10);
            db.run(`INSERT INTO users (nim, nama, email, password, role, jabatan, status) VALUES ('BDHR01', 'Bendahara Himpunan Elektro', 'bendahara@hmte.or.id', ?, 'admin', 'Sekretaris Himpunan', 'aktif')`, [hash]);
        }
    });
});

async function syncToGoogleSheet(dataKas) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: 'credentials.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'Laporan Kas!A:E',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[dataKas.tanggal, dataKas.jenis, dataKas.jumlah, dataKas.keterangan, dataKas.bukti_nota || '-']]
            }
        });
    } catch (err) {
        console.log('Google Sheets Sync skipped:', err.message);
    }
}

function verifyAdmin(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Akses ditolak. Token tidak ditemukan." });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err || decoded.role !== 'admin') {
            return res.status(403).json({ message: "Akses ditolak! Khusus Admin." });
        }
        
        db.get(`SELECT status, jabatan FROM users WHERE id = ?`, [decoded.id], (dbErr, user) => {
            if (dbErr || !user || user.status !== 'aktif' || !['Ketua Himpunan', 'Sekretaris Himpunan', 'Bendahara Himpunan'].includes(user.jabatan)) {
                return res.status(403).json({ message: "Akses ditolak! Masa jabatan Anda telah berakhir atau akun dinonaktifkan." });
            }
            req.user = decoded;
            next();
        });
    });
}

// ENDPOINTS PUBLIK
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Email atau password salah." });
        }
        if (user.status !== 'aktif') {
            return res.status(403).json({ message: "Akses ditolak. Masa jabatan Anda telah berakhir." });
        }
        const token = jwt.sign({ id: user.id, role: user.role, nama: user.nama }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role, nama: user.nama });
    });
});

app.get('/api/anggota/search', (req, res) => {
    const keyword = req.query.q || '';
    const query = `%${keyword}%`;
    db.all(`SELECT nim, nama, status FROM users WHERE role = 'anggota' AND (nim LIKE ? OR nama LIKE ?)`, [query, query], (err, rows) => {
        if (err) return res.status(500).json({ message: "Gagal melakukan pencarian." });
        res.json(rows || []);
    });
});

app.get('/api/kegiatan', (req, res) => {
    db.all(`SELECT * FROM kegiatan ORDER BY id DESC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/uang-kas', (req, res) => {
    const bulan = req.query.month;
    let query = `SELECT * FROM uang_kas`;
    let params = [];
    if (bulan) {
        query += ` WHERE tanggal LIKE ?`;
        params.push(`${bulan}%`);
    }
    query += ` ORDER BY id DESC`;
    db.all(query, params, (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products ORDER BY id DESC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// ENDPOINTS ADMIN
app.get('/api/admin/daftar-pengurus', verifyAdmin, (req, res) => {
    db.all(`SELECT id, nim, nama, email, jabatan, status FROM users WHERE role = 'admin'`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/admin/tambah-pengurus', verifyAdmin, async (req, res) => {
    const { nim, nama, jabatan, email, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (nim, nama, email, password, role, jabatan, status) VALUES (?, ?, ?, ?, 'admin', ?, 'aktif')`,
            [nim, nama, email, hash, jabatan],
            (err) => {
                if (err) return res.status(400).json({ message: "NIM atau Email pengurus sudah terdaftar." });
                res.json({ message: "Akun pengurus baru berhasil ditambahkan!" });
            }
        );
    } catch (err) {
        res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
});

app.patch('/api/admin/pengurus/:id/status', verifyAdmin, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE users SET status = ? WHERE id = ? AND role = 'admin'`, [status, req.params.id], () => {
        res.json({ message: `Status kepengurusan berhasil diubah menjadi ${status}` });
    });
});

app.get('/api/admin/anggota', verifyAdmin, (req, res) => {
    db.all(`SELECT id, nim, nama, email, status FROM users WHERE role = 'anggota'`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/admin/anggota', verifyAdmin, async (req, res) => {
    const { nim, nama, email } = req.body;
    const defaultPassword = await bcrypt.hash('123456', 10);
    db.run(`INSERT INTO users (nim, nama, email, password, role, status) VALUES (?, ?, ?, ?, 'anggota', 'aktif')`,
        [nim, nama, email, defaultPassword],
        (err) => {
            if (err) return res.status(400).json({ message: "NIM atau Email sudah terdaftar." });
            res.json({ message: "Anggota HMTE baru berhasil ditambahkan!" });
        }
    );
});

app.patch('/api/admin/anggota/:id/status', verifyAdmin, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE users SET status = ? WHERE id = ?`, [status, req.params.id], () => {
        res.json({ message: `Status keanggotaan berhasil diubah menjadi ${status}` });
    });
});

app.delete('/api/admin/anggota/:id', verifyAdmin, (req, res) => {
    db.run(`DELETE FROM users WHERE id = ? AND role = 'anggota'`, [req.params.id], () => {
        res.json({ message: "Anggota berhasil dihapus dari database." });
    });
});

app.post('/api/admin/kegiatan', verifyAdmin, (req, res) => {
    const { judul, deskripsi, tanggal, poin_informasi } = req.body;
    db.run(`INSERT INTO kegiatan (judul, deskripsi, tanggal, poin_informasi) VALUES (?, ?, ?, ?)`,
        [judul, deskripsi, tanggal, JSON.stringify(poin_informasi)],
        function () {
            res.json({ message: "Kegiatan berhasil ditambahkan", id: this.lastID });
        }
    );
});

app.delete('/api/admin/kegiatan/:id', verifyAdmin, (req, res) => {
    db.run(`DELETE FROM kegiatan WHERE id = ?`, [req.params.id], () => {
        res.json({ message: "Informasi kegiatan berhasil dihapus." });
    });
});

app.post('/api/admin/uang-kas', verifyAdmin, upload.single('nota'), async (req, res) => {
    const { tanggal, jenis, jumlah, keterangan } = req.body;
    const bukti_nota = req.file ? `/uploads/${req.file.filename}` : '';
    db.run(`INSERT INTO uang_kas (tanggal, jenis, jumlah, keterangan, bukti_nota) VALUES (?, ?, ?, ?, ?)`,
        [tanggal, jenis, parseFloat(jumlah), keterangan, bukti_nota],
        async function () {
            await syncToGoogleSheet({ tanggal, jenis, jumlah, keterangan, bukti_nota });
            res.json({ message: "Transaksi Kas berhasil disimpan & disinkronkan!", id: this.lastID });
        }
    );
});

app.delete('/api/admin/uang-kas/:id', verifyAdmin, (req, res) => {
    db.run(`DELETE FROM uang_kas WHERE id = ?`, [req.params.id], () => {
        res.json({ message: "Informasi uang kas berhasil dihapus." });
    });
});

// Endpoint Manajemen Produk & Stok
app.post('/api/admin/products', verifyAdmin, upload.single('gambar'), (req, res) => {
    const { nama_produk, deskripsi, harga, stok } = req.body;
    const gambar = req.file ? `/uploads/${req.file.filename}` : '';
    db.run(`INSERT INTO products (nama_produk, deskripsi, harga, stok, gambar) VALUES (?, ?, ?, ?, ?)`,
        [nama_produk, deskripsi, parseFloat(harga), parseInt(stok), gambar],
        function () {
            res.json({ message: "Produk berhasil ditambahkan!", id: this.lastID });
        }
    );
});

app.patch('/api/admin/products/:id/stok', verifyAdmin, (req, res) => {
    const { stok } = req.body;
    db.run(`UPDATE products SET stok = ? WHERE id = ?`, [parseInt(stok), req.params.id], () => {
        res.json({ message: "Jumlah stok produk berhasil diperbarui!" });
    });
});

app.delete('/api/admin/products/:id', verifyAdmin, (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], () => {
        res.json({ message: "Produk berhasil dihapus." });
    });
});

app.post('/api/admin/change-password', verifyAdmin, async (req, res) => {
    const { password_lama, password_baru } = req.body;
    db.get(`SELECT password FROM users WHERE id = ?`, [req.user.id], async (err, user) => {
        if (!(await bcrypt.compare(password_lama, user.password))) {
            return res.status(400).json({ message: "Password lama tidak sesuai." });
        }
        const newHash = await bcrypt.hash(password_baru, 10);
        db.run(`UPDATE users SET password = ? WHERE id = ?`, [newHash, req.user.id], () => {
            res.json({ message: "Password admin berhasil diubah secara mandiri!" });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server HMTE running on http://localhost:${PORT}`));