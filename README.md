# COBAIN.ID Website Static + Google Sheets

Website ini dibuat untuk dipakai gratis melalui **GitHub Pages** tanpa `server.js`, tanpa Render, dan tanpa kartu pembayaran.

## Struktur Website

- `index.html` = halaman awal pilihan portal.
- `peserta.html` = portal peserta berisi profil COBAIN.ID, paket Try Out, dan form pendaftaran.
- `host.html` = dashboard host/admin untuk melihat data pendaftar.
- `config.js` = tempat menempel URL Google Apps Script Web App.
- `script.js` = logika interaktif website.
- `style.css` = desain website.
- `assets/` = logo dan visual COBAIN.ID.
- `apps-script/Code.gs` = kode Google Apps Script agar data form masuk ke Google Sheets.

## Alur Sistem

Peserta membuka `peserta.html`, mengisi form, lalu data dikirim ke Google Sheets melalui Google Apps Script. Host membuka `host.html`, login memakai kode host, lalu dashboard membaca data dari Google Sheets.

Peserta tidak dapat melihat data pendaftar lain karena tabel data hanya ada pada halaman `host.html`.

## Setup Google Sheets + Apps Script

1. Buat Google Sheet baru, misalnya: `Database Pendaftar COBAIN.ID`.
2. Buka menu **Extensions > Apps Script**.
3. Hapus kode bawaan.
4. Paste isi file `apps-script/Code.gs`.
5. Klik **Save**.
6. Klik **Deploy > New deployment**.
7. Pilih tipe **Web app**.
8. Atur:
   - **Execute as:** Me
   - **Who has access:** Anyone
9. Klik **Deploy**.
10. Copy **Web App URL**.
11. Buka file `config.js`, lalu ganti:

```js
APPS_SCRIPT_URL: "TEMPEL_URL_WEB_APP_GOOGLE_APPS_SCRIPT_DI_SINI"
```

menjadi URL Web App kamu.

Contoh:

```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/xxxxxxxxxxxxxxxx/exec"
```

## Setup GitHub Pages

1. Upload seluruh isi folder ini ke repository GitHub.
2. Buka repository GitHub.
3. Masuk ke **Settings > Pages**.
4. Pada **Build and deployment**, pilih:
   - **Source:** Deploy from a branch
   - **Branch:** main
   - **Folder:** /root
5. Klik **Save**.
6. Tunggu beberapa menit sampai link GitHub Pages aktif.

Link peserta biasanya:

```text
https://username.github.io/nama-repo/peserta.html
```

Link host/admin:

```text
https://username.github.io/nama-repo/host.html
```

## Kode Host Default

```text
COBAINHOST
```

Kode host bisa diganti pada:

- `config.js`
- `apps-script/Code.gs`

Pastikan keduanya sama.

## Catatan Keamanan

Versi ini cocok untuk tahap awal dan kebutuhan gratis. Karena website statis bersifat terbuka, proteksi host berbasis kode ini belum setara sistem login profesional. Untuk lembaga yang sudah besar, gunakan backend/database dengan autentikasi sungguhan.
