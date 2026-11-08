DROP TABLE IF EXISTS detail_produksi;
DROP TABLE IF EXISTS tanggapan_feedback;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS detail_pesanan;
DROP TABLE IF EXISTS laporan;
DROP TABLE IF EXISTS produksi;
DROP TABLE IF EXISTS pesanan;
DROP TABLE IF EXISTS produk;
DROP TABLE IF EXISTS kategori;
DROP TABLE IF EXISTS voucher;
DROP TABLE IF EXISTS pelanggan;
DROP TABLE IF EXISTS karyawan;
DROP TABLE IF EXISTS kode_pos;
DROP TABLE IF EXISTS pengguna;

CREATE TABLE pengguna (
    id_user VARCHAR(10) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    status_akun VARCHAR(20) NOT NULL,
    tanggal_registrasi DATE NOT NULL,
    tanggal_login_terakhir DATE
);

CREATE TABLE kode_pos (
    kode_pos VARCHAR(10) PRIMARY KEY,
    kelurahan VARCHAR(100) NOT NULL,
    kecamatan VARCHAR(100) NOT NULL,
    kota VARCHAR(100) NOT NULL,
    provinsi VARCHAR(100) NOT NULL
);

CREATE TABLE kategori (
    id_kategori VARCHAR(10) PRIMARY KEY,
    nama_kategori VARCHAR(50) NOT NULL
);

CREATE TABLE voucher (
    kode_voucher VARCHAR(20) PRIMARY KEY,
    potongan_voucher NUMERIC(10,2) NOT NULL
);

CREATE TABLE pelanggan (
    id_pelanggan VARCHAR(10) PRIMARY KEY,
    nama_pelanggan VARCHAR(100) NOT NULL,
    no_hp VARCHAR(15) NOT NULL,
    alamat VARCHAR(100) NOT NULL,
    jenis_kelamin VARCHAR(15),
    tgl_lahir DATE,
    id_user VARCHAR(10) NOT NULL,
    kode_pos VARCHAR(10) NOT NULL,
    FOREIGN KEY (id_user) REFERENCES pengguna(id_user),
    FOREIGN KEY (kode_pos) REFERENCES kode_pos(kode_pos)
);

CREATE TABLE karyawan (
    id_karyawan VARCHAR(10) PRIMARY KEY,
    nama_karyawan VARCHAR(100) NOT NULL,
    jabatan VARCHAR(50) NOT NULL,
    no_hp VARCHAR(15) NOT NULL,
    tgl_lahir DATE,
    jenis_kelamin VARCHAR(15),
    id_user VARCHAR(10) NOT NULL,
    kode_pos VARCHAR(10) NOT NULL,
    FOREIGN KEY (id_user) REFERENCES pengguna(id_user),
    FOREIGN KEY (kode_pos) REFERENCES kode_pos(kode_pos)
);

CREATE TABLE produk (
    id_produk VARCHAR(10) PRIMARY KEY,
    nama_produk VARCHAR(100) NOT NULL,
    harga NUMERIC(10,2) NOT NULL,
    id_kategori VARCHAR(10) NOT NULL,
    FOREIGN KEY (id_kategori) REFERENCES kategori(id_kategori)
);

CREATE TABLE pesanan (
    no_nota VARCHAR(10) PRIMARY KEY,
    tgl_nota DATE NOT NULL,
    total_bayar NUMERIC(10,2) NOT NULL,
    metode_bayar VARCHAR(50),
    status_bayar VARCHAR(20) NOT NULL,
    tgl_bayar DATE,
    id_pelanggan VARCHAR(10) NOT NULL,
    id_karyawan VARCHAR(10) NOT NULL,
    kode_voucher VARCHAR(20),
    konfirmasi_pembayaran VARCHAR(20),
    FOREIGN KEY (id_pelanggan) REFERENCES pelanggan(id_pelanggan),
    FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan),
    FOREIGN KEY (kode_voucher) REFERENCES voucher(kode_voucher)
);

CREATE TABLE detail_pesanan (
    id_detail VARCHAR(10) PRIMARY KEY,
    no_nota VARCHAR(10) NOT NULL,
    id_produk VARCHAR(10) NOT NULL,
    jumlah INTEGER NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    FOREIGN KEY (no_nota) REFERENCES pesanan(no_nota),
    FOREIGN KEY (id_produk) REFERENCES produk(id_produk)
);

CREATE TABLE feedback (
    id_feedback VARCHAR(10) PRIMARY KEY,
    isi_feedback VARCHAR(255) NOT NULL,
    tgl_feedback DATE NOT NULL,
    no_nota VARCHAR(10) NOT NULL,
    FOREIGN KEY (no_nota) REFERENCES pesanan(no_nota)
);

CREATE TABLE tanggapan_feedback (
    id_tanggapan VARCHAR(10) PRIMARY KEY,
    isi_tanggapan VARCHAR(255) NOT NULL,
    tgl_tanggapan DATE NOT NULL,
    id_feedback VARCHAR(10) NOT NULL,
    id_karyawan VARCHAR(10) NOT NULL,
    FOREIGN KEY (id_feedback) REFERENCES feedback(id_feedback),
    FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan)
);

CREATE TABLE produksi (
    id_produksi VARCHAR(10) PRIMARY KEY,
    tgl_produksi DATE,
    status_peringatan_stok VARCHAR(50),
    id_karyawan VARCHAR(10),
    FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan)
);

CREATE TABLE detail_produksi (
    id_detail_produksi VARCHAR(10) PRIMARY KEY,
    id_produksi VARCHAR(10) NOT NULL,
    id_produk VARCHAR(10) NOT NULL,
    jumlah_produksi INTEGER NOT NULL,
    FOREIGN KEY (id_produksi) REFERENCES produksi(id_produksi),
    FOREIGN KEY (id_produk) REFERENCES produk(id_produk)
);

CREATE TABLE laporan (
    id_laporan VARCHAR(10) PRIMARY KEY,
    jenis_laporan VARCHAR(50) NOT NULL,
    total_laporan NUMERIC(15,2) NOT NULL,
    id_user VARCHAR(10) NOT NULL,
    FOREIGN KEY (id_user) REFERENCES pengguna(id_user)
);

INSERT INTO pengguna VALUES ('U01', 'icha_admin', 'icha123', 'icha.admin@gmail.com', 'Admin', 'Aktif', '2026-09-15', '2026-10-05');
INSERT INTO pengguna VALUES ('U02', 'caca_admin', 'Caca12345', 'caca.admin@gmail.com', 'Admin', 'Aktif', '2026-09-17', '2026-10-04');
INSERT INTO pengguna VALUES ('U03', 'azizah_owner', 'Azizah1267', 'owner.azizah@gmail.com', 'Owner', 'Aktif', '2026-09-16', '2026-10-06');
INSERT INTO pengguna VALUES ('U04', 'nadya_p', 'nadya123', 'nadya@gmail.com', 'Karyawan', 'Aktif', '2026-09-15', '2026-10-01');
INSERT INTO pengguna VALUES ('U05', 'ami_p', 'ami123', 'ami@gmail.com', 'Karyawan', 'Aktif', '2026-09-15', '2026-10-02');
INSERT INTO pengguna VALUES ('U06', 'rahmat_h', 'rahmat123', 'rahmat.habibi@gmail.com', 'Pelanggan', 'Aktif', '2026-09-20', '2026-10-04');
INSERT INTO pengguna VALUES ('U07', 'putri_a', 'putri2000', 'putri.alifa@gmail.com', 'Pelanggan', 'Aktif', '2026-09-22', '2026-10-05');
INSERT INTO pengguna VALUES ('U08', 'aziz_w', 'aziz123', 'aziz.wahyu@gmail.com', 'Pelanggan', 'Aktif', '2026-09-25', '2026-10-04');
INSERT INTO pengguna VALUES ('U09', 'halia_p', 'halia123', 'halia.putri@gmail.com', 'Pelanggan', 'Aktif', '2026-09-26', '2026-10-08');

INSERT INTO kode_pos VALUES ('25129', 'Jati Baru', 'Padang Timur', 'Padang', 'Sumatera Barat');
INSERT INTO kode_pos VALUES ('25153', 'Kuranji', 'Kuranji', 'Padang', 'Sumatera Barat');
INSERT INTO kode_pos VALUES ('25163', 'Limau Manis', 'Pauh', 'Padang', 'Sumatera Barat');
INSERT INTO kode_pos VALUES ('25146', 'Surau Gadang', 'Nanggalo', 'Padang', 'Sumatera Barat');
INSERT INTO kode_pos VALUES ('25117', 'Kampung Jao', 'Padang Barat', 'Padang', 'Sumatera Barat');

INSERT INTO kategori VALUES ('K01', 'Kerupuk Bawang');
INSERT INTO kategori VALUES ('K02', 'Stik');
INSERT INTO kategori VALUES ('K03', 'Kerupuk Bawang (Kedelai)');

INSERT INTO voucher VALUES ('DISKON10', 18000);
INSERT INTO voucher VALUES ('DISKON11', 18000);
INSERT INTO voucher VALUES ('DISKON12', 18000);
INSERT INTO voucher VALUES ('DISKON13', 18000);
INSERT INTO voucher VALUES ('DISKON14', 18000);

INSERT INTO pelanggan VALUES ('PL01', 'Rahmat Habibi', '081268451203', 'Jl. Sudirman', 'Laki-Laki', '1998-02-14', 'U06', '25129');
INSERT INTO pelanggan VALUES ('PL02', 'Putri Alifa', '08217420156', 'Jl. Tuanku Tambusai', 'Perempuan', '2000-08-21', 'U07', '25129');
INSERT INTO pelanggan VALUES ('PL03', 'Aziz Wahyu', '085278341102', 'Jl. Arifin Ahmad', 'Laki-Laki', '2001-02-09', 'U08', '25153');
INSERT INTO pelanggan VALUES ('PL04', 'Halia Putri', '081365027784', 'Jl. Limau Manis', 'Perempuan', '1997-11-30', 'U09', '25163');

INSERT INTO karyawan VALUES ('K01', 'Icha Khairani', 'Admin', '081299988888', '1995-01-01', 'Perempuan', 'U01', '25163');
INSERT INTO karyawan VALUES ('K02', 'Caca', 'Admin', '081234567892', '2000-09-26', 'Perempuan', 'U02', '25146');
INSERT INTO karyawan VALUES ('K03', 'Nadya', 'Karyawan', '081277001234', '1995-10-05', 'Perempuan', 'U04', '25146');
INSERT INTO karyawan VALUES ('K04', 'Ami', 'Karyawan', '082188112233', '2000-10-20', 'Perempuan', 'U05', '25117');

INSERT INTO produk VALUES ('P01', 'Kerupuk Bawang Original', 18000, 'K01');
INSERT INTO produk VALUES ('P02', 'Stik Keju', 25000, 'K02');
INSERT INTO produk VALUES ('P03', 'Kerupuk Bawang Kedelai', 18000, 'K03');
INSERT INTO produk VALUES ('P04', 'Stik Kentang', 18000, 'K02');
INSERT INTO produk VALUES ('P05', 'Kerupuk Bawang Pedas', 18000, 'K01');

INSERT INTO pesanan VALUES ('N001', '2026-10-01', 68000, 'Transfer BRI', 'Lunas', '2026-10-01', 'PL01', 'K01', 'DISKON10', 'Terverifikasi');
INSERT INTO pesanan VALUES ('N002', '2026-10-01', 162000, 'QRIS', 'Lunas', '2026-10-01', 'PL02', 'K01', 'DISKON11', 'Terverifikasi');
INSERT INTO pesanan VALUES ('N003', '2026-10-03', 72000, 'QRIS', 'Lunas', '2026-10-03', 'PL01', 'K01', 'DISKON12', 'Terverifikasi');
INSERT INTO pesanan VALUES ('N004', '2026-10-04', 36000, 'Transfer BRI', 'Lunas', '2026-10-04', 'PL03', 'K02', 'DISKON13', 'Terverifikasi');
INSERT INTO pesanan VALUES ('N005', '2026-10-05', 43000, 'QRIS', 'Lunas', '2026-10-06', 'PL04', 'K02', 'DISKON14', 'Terverifikasi');

INSERT INTO detail_pesanan VALUES ('DP01', 'N001', 'P01', 2, 36000);
INSERT INTO detail_pesanan VALUES ('DP02', 'N001', 'P02', 2, 50000);
INSERT INTO detail_pesanan VALUES ('DP03', 'N002', 'P03', 10, 180000);
INSERT INTO detail_pesanan VALUES ('DP04', 'N003', 'P01', 2, 36000);
INSERT INTO detail_pesanan VALUES ('DP05', 'N003', 'P04', 1, 18000);
INSERT INTO detail_pesanan VALUES ('DP06', 'N003', 'P05', 2, 36000);
INSERT INTO detail_pesanan VALUES ('DP07', 'N004', 'P05', 2, 36000);
INSERT INTO detail_pesanan VALUES ('DP08', 'N004', 'P04', 1, 18000);
INSERT INTO detail_pesanan VALUES ('DP09', 'N005', 'P01', 2, 36000);
INSERT INTO detail_pesanan VALUES ('DP10', 'N005', 'P02', 1, 25000);

INSERT INTO feedback VALUES ('FB01', 'Kerupuk enak dan gurih, Suka Stik Kejunya', '2026-10-05', 'N001');
INSERT INTO feedback VALUES ('FB02', 'Pengiriman Cepat, Kemasan Rapi', '2026-10-06', 'N002');
INSERT INTO feedback VALUES ('FB03', 'Harga sangat sesuai dengan rasanya', '2026-10-08', 'N003');
INSERT INTO feedback VALUES ('FB04', 'Responnya cepat dan rasanya enak', '2026-10-11', 'N004');
INSERT INTO feedback VALUES ('FB05', 'Rasa Renyah dan Harga Sesuai', '2026-10-09', 'N005');

INSERT INTO tanggapan_feedback VALUES ('TG01', 'Terima Kasih atas ulasannya, kami senang Anda Puas', '2026-10-05', 'FB01', 'K01');
INSERT INTO tanggapan_feedback VALUES ('TG02', 'Terima Kasih, Kami akan terus menjaga kualitas', '2026-10-06', 'FB02', 'K01');
INSERT INTO tanggapan_feedback VALUES ('TG03', 'Terimakasih, kami akan selalu memperhatikan pelanggan', '2026-10-08', 'FB03', 'K01');
INSERT INTO tanggapan_feedback VALUES ('TG04', 'Terimakasih telah berbelanja dan sampai jumpa lagi', '2026-10-11', 'FB04', 'K02');
INSERT INTO tanggapan_feedback VALUES ('TG05', 'Terima Kasih, Silahkan Order Kembali', '2026-10-09', 'FB05', 'K02');

INSERT INTO produksi VALUES ('PRD01', '2026-10-01', 'Sudah Dibaca', 'K03');
INSERT INTO produksi VALUES ('PRD02', '2026-10-02', 'Sudah Dibaca', 'K04');
INSERT INTO produksi VALUES ('PRD03', NULL, NULL, NULL);

INSERT INTO detail_produksi VALUES ('DPR01', 'PRD01', 'P01', 60);
INSERT INTO detail_produksi VALUES ('DPR02', 'PRD02', 'P02', 30);
INSERT INTO detail_produksi VALUES ('DPR03', 'PRD03', 'P03', 50);

INSERT INTO laporan VALUES ('LAP001', 'Laporan Penjualan', 381000, 'U03');
INSERT INTO laporan VALUES ('LAP002', 'Laporan Transaksi', 381000, 'U03');
INSERT INTO laporan VALUES ('LAP003', 'Laporan Feedback', 5, 'U03');

SELECT * FROM pengguna;
SELECT * FROM kode_pos;
SELECT * FROM kategori;
SELECT * FROM voucher;
SELECT * FROM pelanggan;
SELECT * FROM karyawan;
SELECT * FROM produk;
SELECT * FROM pesanan;
SELECT * FROM detail_pesanan;
SELECT * FROM feedback;
SELECT * FROM tanggapan_feedback;
SELECT * FROM produksi;
SELECT * FROM detail_produksi;
SELECT * FROM laporan;

SELECT p.no_nota, p.tgl_nota, pl.nama_pelanggan, k.nama_karyawan,
       pr.nama_produk, dp.jumlah, dp.subtotal, p.total_bayar,
       p.metode_bayar, p.status_bayar
FROM pesanan p
JOIN pelanggan pl ON pl.id_pelanggan = p.id_pelanggan
JOIN karyawan k ON k.id_karyawan = p.id_karyawan
JOIN detail_pesanan dp ON dp.no_nota = p.no_nota
JOIN produk pr ON pr.id_produk = dp.id_produk
ORDER BY p.no_nota, pr.id_produk;

SELECT pl.id_pelanggan, pl.nama_pelanggan, pl.no_hp, pl.alamat,
       kp.kode_pos, kp.kelurahan, kp.kecamatan, kp.kota, kp.provinsi
FROM pelanggan pl
JOIN kode_pos kp ON kp.kode_pos = pl.kode_pos
ORDER BY pl.id_pelanggan;

SELECT k.id_karyawan, k.nama_karyawan, k.jabatan, k.no_hp,
       u.username, u.email, kp.kode_pos, kp.kelurahan, kp.kecamatan
FROM karyawan k
JOIN pengguna u ON u.id_user = k.id_user
JOIN kode_pos kp ON kp.kode_pos = k.kode_pos
ORDER BY k.id_karyawan;

SELECT pr.id_produk, pr.nama_produk, kt.nama_kategori, pr.harga
FROM produk pr
JOIN kategori kt ON kt.id_kategori = pr.id_kategori
ORDER BY pr.id_produk;

SELECT f.id_feedback, f.no_nota, pl.nama_pelanggan, f.tgl_feedback,
       f.isi_feedback, tf.id_tanggapan, tf.tgl_tanggapan,
       tf.isi_tanggapan, k.nama_karyawan
FROM feedback f
JOIN pesanan p ON p.no_nota = f.no_nota
JOIN pelanggan pl ON pl.id_pelanggan = p.id_pelanggan
JOIN tanggapan_feedback tf ON tf.id_feedback = f.id_feedback
JOIN karyawan k ON k.id_karyawan = tf.id_karyawan
ORDER BY f.id_feedback;

SELECT pr.id_produksi, pr.tgl_produksi, k.nama_karyawan,
       pd.id_produk, pd.nama_produk, dp.jumlah_produksi,
       pr.status_peringatan_stok
FROM produksi pr
JOIN karyawan k ON k.id_karyawan = pr.id_karyawan
JOIN detail_produksi dp ON dp.id_produksi = pr.id_produksi
JOIN produk pd ON pd.id_produk = dp.id_produk
ORDER BY pr.id_produksi;

SELECT l.id_laporan, l.jenis_laporan, l.total_laporan, u.id_user, u.username
FROM laporan l
JOIN pengguna u ON u.id_user = l.id_user
ORDER BY l.id_laporan;

SELECT no_nota, tgl_nota, total_bayar, metode_bayar
FROM pesanan
WHERE metode_bayar = 'QRIS'
ORDER BY no_nota;

SELECT COUNT(*) AS jumlah_pesanan FROM pesanan;
SELECT SUM(total_bayar) AS total_penjualan FROM pesanan;
SELECT COUNT(*) AS jumlah_pelanggan FROM pelanggan;
SELECT COUNT(*) AS jumlah_produk FROM produk;
SELECT COUNT(*) AS jumlah_feedback FROM feedback;