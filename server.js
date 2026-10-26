const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inisialisasi Firebase Admin SDK (Pastikan URL menunjuk ke root, tanpa path di belakangnya)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://himpunanteknikelektro-b3188-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();
console.log('Database Firebase Realtime Database connected.');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Konfigurasi Multer untuk Upload File (Produk & Nota Kas)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

const JWT_SECRET = process.env.JWT_SECRET || 'hmte-secret-key-2026';

// Middleware Autentikasi JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Token tidak valid' });
    req.user = user;
    next();
  });
};

// Inisialisasi Akun Admin Default
async function initDefaultAdmins() {
  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    if (!snapshot.exists()) {
      const defaultAdmins = [
        { nim: '001', nama: 'Ketua Himpunan', email: 'ketua@hmte.or.id', pass: 'ketua123', jabatan: 'Ketua Himpunan', status: 'aktif' },
        { nim: '002', nama: 'Sekretaris Himpunan', email: 'sekretaris@hmte.or.id', pass: 'sekretaris123', jabatan: 'Sekretaris Himpunan', status: 'aktif' },
        { nim: '003', nama: 'Bendahara Himpunan', email: 'bendahara@hmte.or.id', pass: 'bendahara123', jabatan: 'Bendahara Himpunan', status: 'aktif' }
      ];

      const updates = {};
      for (let adminData of defaultAdmins) {
        const hashedPassword = await bcrypt.hash(adminData.pass, 10);
        const newUserRef = usersRef.push();
        updates[newUserRef.key] = {
          nim: adminData.nim,
          nama: adminData.nama,
          email: adminData.email,
          password: hashedPassword,
          jabatan: adminData.jabatan,
          status: adminData.status,
          createdAt: Date.now()
        };
      }
      await usersRef.update(updates);
      console.log('Akun admin default berhasil diinisialisasi ke Firebase.');
    }
  } catch (error) {
    console.error('Gagal menginisialisasi admin default:', error.message);
  }
}
initDefaultAdmins();

// ================= LOGIN ROUTE =================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usersRef = db.ref('users');
    const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
    
    if (!snapshot.exists()) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const usersData = snapshot.val();
    const userId = Object.keys(usersData)[0];
    const user = usersData[userId];

    if (user.status && user.status !== 'aktif') {
      return res.status(403).json({ success: false, message: 'Akun pengurus ini dinonaktifkan' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const token = jwt.sign({ id: userId, email: user.email, jabatan: user.jabatan }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ success: true, message: 'Login berhasil', token, user: { nama: user.nama, email: user.email, jabatan: user.jabatan } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= ENDPOINT PUBLIK (UNTUK INDEX.HTML) =================
app.get('/api/anggota', async (req, res) => {
  try {
    const snapshot = await db.ref('anggota').once('value');
    const data = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/kegiatan', async (req, res) => {
  try {
    const snapshot = await db.ref('kegiatan').once('value');
    const data = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const snapshot = await db.ref('products').once('value');
    const data = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/uang-kas', async (req, res) => {
  try {
    const snapshot = await db.ref('uang-kas').once('value');
    const data = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= MANAJEMEN PENGURUS (ADMIN) =================
app.get('/api/admin/daftar-pengurus', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.ref('users').once('value');
    const data = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/tambah-pengurus', verifyToken, async (req, res) => {
  try {
    const { nim, nama, jabatan, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    await db.ref('users').push({
      nim, nama, jabatan, email,
      password: hashedPassword,
      status: 'aktif',
      createdAt: Date.now()
    });
    res.json({ success: true, message: 'Pengurus baru berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/admin/pengurus/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.ref('users/' + id).update({ status });
    res.json({ success: true, message: `Status pengurus diubah menjadi ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= MANAJEMEN PRODUK (ADMIN) =================
app.post('/api/admin/products', verifyToken, upload.single('gambar'), async (req, res) => {
  try {
    const { nama_produk, harga, stok, deskripsi } = req.body;
    const gambar = req.file ? `/uploads/${req.file.filename}` : '';
    await db.ref('products').push({
      nama_produk, harga: Number(harga), stok: Number(stok), deskripsi, gambar,
      createdAt: Date.now()
    });
    res.json({ success: true, message: 'Produk berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/admin/products/:id/stok', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { stok } = req.body;
    await db.ref('products/' + id).update({ stok: Number(stok) });
    res.json({ success: true, message: 'Stok berhasil diperbarui' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/products/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.ref('products/' + id).remove();
    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= MANAJEMEN ANGGOTA HMTE (ADMIN) =================
app.post('/api/admin/anggota', verifyToken, async (req, res) => {
  try {
    const { nim, nama, email } = req.body;
    await db.ref('anggota').push({
      nim, nama, email,
      status: 'aktif',
      createdAt: Date.now()
    });
    res.json({ success: true, message: 'Anggota berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/admin/anggota/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.ref('anggota/' + id).update({ status });
    res.json({ success: true, message: `Status anggota diubah menjadi ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/anggota/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.ref('anggota/' + id).remove();
    res.json({ success: true, message: 'Anggota berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= MANAJEMEN KEGIATAN (ADMIN) =================
app.post('/api/admin/kegiatan', verifyToken, async (req, res) => {
  try {
    const { judul, tanggal, deskripsi, poin_informasi } = req.body;
    await db.ref('kegiatan').push({
      judul, tanggal, deskripsi,
      poin_informasi: poin_informasi || [],
      createdAt: Date.now()
    });
    res.json({ success: true, message: 'Kegiatan berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/kegiatan/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.ref('kegiatan/' + id).remove();
    res.json({ success: true, message: 'Kegiatan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= MANAJEMEN UANG KAS (ADMIN) =================
app.post('/api/admin/uang-kas', verifyToken, upload.single('nota'), async (req, res) => {
  try {
    const { tanggal, jenis, jumlah, keterangan } = req.body;
    const nota = req.file ? `/uploads/${req.file.filename}` : '';
    await db.ref('uang-kas').push({
      tanggal, jenis, jumlah: Number(jumlah), keterangan, nota,
      createdAt: Date.now()
    });
    res.json({ success: true, message: 'Data kas berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/uang-kas/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.ref('uang-kas/' + id).remove();
    res.json({ success: true, message: 'Data kas berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= UBAH PASSWORD =================
app.post('/api/admin/change-password', verifyToken, async (req, res) => {
  try {
    const { password_lama, password_baru } = req.body;
    const userId = req.user.id;

    const userRef = db.ref('users/' + userId);
    const snapshot = await userRef.once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const user = snapshot.val();
    const isMatch = await bcrypt.compare(password_lama, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Password lama salah' });
    }

    const hashedNewPassword = await bcrypt.hash(password_baru, 10);
    await userRef.update({ password: hashedNewPassword });
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server HMTE running on http://localhost:${PORT}`);
});