# EDclub
Situs komunitas English Day Social Club (ED Club). Halaman statis biasa, di-deploy di Vercel.

## Papan semangat (Bromo Marathon)

Hitungan "Semangat Ayah!" dan pesan di `bromo-marathon.html` disimpan lewat fungsi Vercel di folder `api/`
(`api/cheer.js`, `api/comments.js`) ke database Upstash Redis.

Cara mengaktifkan (sekali saja):

1. Buka proyek di dashboard Vercel, pilih tab **Storage**, lalu **Create Database** → **Upstash for Redis** (paket gratis).
2. Sambungkan database ke proyek ini untuk semua environment.
3. Deploy ulang (Redeploy atau push commit baru).

Fungsi membaca variabel `KV_REST_API_URL` dan `KV_REST_API_TOKEN` (atau `UPSTASH_REDIS_REST_URL` dan
`UPSTASH_REDIS_REST_TOKEN`) yang dibuat otomatis oleh integrasi. Sebelum database tersambung, papan menampilkan
"Papan semangat segera aktif" dan form pesan dinonaktifkan.

Pesan yang tidak pantas bisa dihapus dari daftar `ed:bromo26:comments` lewat Data Browser di konsol Upstash.
