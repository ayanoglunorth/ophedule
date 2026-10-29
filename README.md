# Ophedule

Arkadaş grupları için ortak uygunluk takvimi ve tarihleri belli gezilerin karşılaştırması.

## Geliştirme

- Node.js 22.13+ gerekir.
- `npm ci`
- `npm run db:generate` yalnız şema değiştiğinde.
- `npm run build`
- `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_light_gabe_jones.sql` yalnız ilk yerel kurulumda.
- `npm run dev`

## Veri ve erişim

Sites, D1 bağını `.openai/hosting.json` üzerinden sağlar. Üretim migration dosyaları dağıtım sırasında uygulanır. Site herkese açık ziyaret edilebilir; oda verileri uygulama hesabı ve onaylı üyelik gerektirir. Kullanıcı adı ve şifre uygulamaya özeldir, ChatGPT hesabı gerekmez. Şifre sıfırlama için e-posta akışı bulunmaz. Bir gezi için tarihlerin tamamı işaretli, bütçe yeterli ve ilgi puanı sıfırdan büyük olduğunda üye katılabilir sayılır. Boş ilgi puanı üç kabul edilir.

Uçuş fiyatları otomatik alınmaz; bilet ve kişi başı harcama tahminleri elle girilir.
