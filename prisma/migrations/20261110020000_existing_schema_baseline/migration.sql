-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."detail_pesanan" (
    "id_detail" VARCHAR(10) NOT NULL,
    "no_nota" VARCHAR(10) NOT NULL,
    "id_produk" VARCHAR(10) NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "detail_pesanan_pkey" PRIMARY KEY ("id_detail")
);

-- CreateTable
CREATE TABLE "public"."detail_produksi" (
    "id_detail_produksi" VARCHAR(10) NOT NULL,
    "id_produksi" VARCHAR(10) NOT NULL,
    "id_produk" VARCHAR(10) NOT NULL,
    "jumlah_produksi" INTEGER NOT NULL,

    CONSTRAINT "detail_produksi_pkey" PRIMARY KEY ("id_detail_produksi")
);

-- CreateTable
CREATE TABLE "public"."feedback" (
    "id_feedback" VARCHAR(10) NOT NULL,
    "isi_feedback" VARCHAR(255) NOT NULL,
    "tgl_feedback" DATE NOT NULL,
    "no_nota" VARCHAR(10) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id_feedback")
);

-- CreateTable
CREATE TABLE "public"."karyawan" (
    "id_karyawan" VARCHAR(10) NOT NULL,
    "nama_karyawan" VARCHAR(100) NOT NULL,
    "jabatan" VARCHAR(50) NOT NULL,
    "no_hp" VARCHAR(15) NOT NULL,
    "tgl_lahir" DATE,
    "jenis_kelamin" VARCHAR(15),
    "id_user" VARCHAR(10) NOT NULL,
    "kode_pos" VARCHAR(10) NOT NULL,

    CONSTRAINT "karyawan_pkey" PRIMARY KEY ("id_karyawan")
);

-- CreateTable
CREATE TABLE "public"."kategori" (
    "id_kategori" VARCHAR(10) NOT NULL,
    "nama_kategori" VARCHAR(50) NOT NULL,

    CONSTRAINT "kategori_pkey" PRIMARY KEY ("id_kategori")
);

-- CreateTable
CREATE TABLE "public"."kode_pos" (
    "kode_pos" VARCHAR(10) NOT NULL,
    "kelurahan" VARCHAR(100) NOT NULL,
    "kecamatan" VARCHAR(100) NOT NULL,
    "kota" VARCHAR(100) NOT NULL,
    "provinsi" VARCHAR(100) NOT NULL,

    CONSTRAINT "kode_pos_pkey" PRIMARY KEY ("kode_pos")
);

-- CreateTable
CREATE TABLE "public"."laporan" (
    "id_laporan" VARCHAR(10) NOT NULL,
    "jenis_laporan" VARCHAR(50) NOT NULL,
    "total_laporan" DECIMAL(15,2) NOT NULL,
    "id_user" VARCHAR(10) NOT NULL,

    CONSTRAINT "laporan_pkey" PRIMARY KEY ("id_laporan")
);

-- CreateTable
CREATE TABLE "public"."pelanggan" (
    "id_pelanggan" VARCHAR(10) NOT NULL,
    "nama_pelanggan" VARCHAR(100) NOT NULL,
    "no_hp" VARCHAR(15) NOT NULL,
    "alamat" VARCHAR(100) NOT NULL,
    "jenis_kelamin" VARCHAR(15),
    "tgl_lahir" DATE,
    "id_user" VARCHAR(10) NOT NULL,
    "kode_pos" VARCHAR(10) NOT NULL,

    CONSTRAINT "pelanggan_pkey" PRIMARY KEY ("id_pelanggan")
);

-- CreateTable
CREATE TABLE "public"."pengguna" (
    "id_user" VARCHAR(10) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "status_akun" VARCHAR(20) NOT NULL,
    "tanggal_registrasi" DATE NOT NULL,
    "tanggal_login_terakhir" DATE,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id_user")
);

-- CreateTable
CREATE TABLE "public"."pesanan" (
    "no_nota" VARCHAR(10) NOT NULL,
    "tgl_nota" DATE NOT NULL,
    "total_bayar" DECIMAL(10,2) NOT NULL,
    "metode_bayar" VARCHAR(50),
    "status_bayar" VARCHAR(20) NOT NULL,
    "tgl_bayar" DATE,
    "id_pelanggan" VARCHAR(10) NOT NULL,
    "id_karyawan" VARCHAR(10) NOT NULL,
    "kode_voucher" VARCHAR(20),
    "konfirmasi_pembayaran" VARCHAR(20),

    CONSTRAINT "pesanan_pkey" PRIMARY KEY ("no_nota")
);

-- CreateTable
CREATE TABLE "public"."produk" (
    "id_produk" VARCHAR(10) NOT NULL,
    "nama_produk" VARCHAR(100) NOT NULL,
    "harga" DECIMAL(10,2) NOT NULL,
    "id_kategori" VARCHAR(10) NOT NULL,

    CONSTRAINT "produk_pkey" PRIMARY KEY ("id_produk")
);

-- CreateTable
CREATE TABLE "public"."produksi" (
    "id_produksi" VARCHAR(10) NOT NULL,
    "tgl_produksi" DATE,
    "status_peringatan_stok" VARCHAR(50),
    "id_karyawan" VARCHAR(10),

    CONSTRAINT "produksi_pkey" PRIMARY KEY ("id_produksi")
);

-- CreateTable
CREATE TABLE "public"."tanggapan_feedback" (
    "id_tanggapan" VARCHAR(10) NOT NULL,
    "isi_tanggapan" VARCHAR(255) NOT NULL,
    "tgl_tanggapan" DATE NOT NULL,
    "id_feedback" VARCHAR(10) NOT NULL,
    "id_karyawan" VARCHAR(10) NOT NULL,

    CONSTRAINT "tanggapan_feedback_pkey" PRIMARY KEY ("id_tanggapan")
);

-- CreateTable
CREATE TABLE "public"."voucher" (
    "kode_voucher" VARCHAR(20) NOT NULL,
    "potongan_voucher" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "voucher_pkey" PRIMARY KEY ("kode_voucher")
);

-- AddForeignKey
ALTER TABLE "public"."detail_pesanan" ADD CONSTRAINT "detail_pesanan_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "public"."produk"("id_produk") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."detail_pesanan" ADD CONSTRAINT "detail_pesanan_no_nota_fkey" FOREIGN KEY ("no_nota") REFERENCES "public"."pesanan"("no_nota") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."detail_produksi" ADD CONSTRAINT "detail_produksi_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "public"."produk"("id_produk") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."detail_produksi" ADD CONSTRAINT "detail_produksi_id_produksi_fkey" FOREIGN KEY ("id_produksi") REFERENCES "public"."produksi"("id_produksi") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."feedback" ADD CONSTRAINT "feedback_no_nota_fkey" FOREIGN KEY ("no_nota") REFERENCES "public"."pesanan"("no_nota") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."karyawan" ADD CONSTRAINT "karyawan_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."pengguna"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."karyawan" ADD CONSTRAINT "karyawan_kode_pos_fkey" FOREIGN KEY ("kode_pos") REFERENCES "public"."kode_pos"("kode_pos") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."laporan" ADD CONSTRAINT "laporan_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."pengguna"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pelanggan" ADD CONSTRAINT "pelanggan_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."pengguna"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pelanggan" ADD CONSTRAINT "pelanggan_kode_pos_fkey" FOREIGN KEY ("kode_pos") REFERENCES "public"."kode_pos"("kode_pos") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pesanan" ADD CONSTRAINT "pesanan_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "public"."karyawan"("id_karyawan") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pesanan" ADD CONSTRAINT "pesanan_id_pelanggan_fkey" FOREIGN KEY ("id_pelanggan") REFERENCES "public"."pelanggan"("id_pelanggan") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pesanan" ADD CONSTRAINT "pesanan_kode_voucher_fkey" FOREIGN KEY ("kode_voucher") REFERENCES "public"."voucher"("kode_voucher") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."produk" ADD CONSTRAINT "produk_id_kategori_fkey" FOREIGN KEY ("id_kategori") REFERENCES "public"."kategori"("id_kategori") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."produksi" ADD CONSTRAINT "produksi_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "public"."karyawan"("id_karyawan") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tanggapan_feedback" ADD CONSTRAINT "tanggapan_feedback_id_feedback_fkey" FOREIGN KEY ("id_feedback") REFERENCES "public"."feedback"("id_feedback") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tanggapan_feedback" ADD CONSTRAINT "tanggapan_feedback_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "public"."karyawan"("id_karyawan") ON DELETE NO ACTION ON UPDATE NO ACTION;
