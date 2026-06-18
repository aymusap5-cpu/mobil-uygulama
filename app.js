// ── AYARLAR ──
const DB_ADI = 'DosyaArsivim';
const DB_SURUM = 1;
const STORE_ADI = 'dosyalar';

// ── STATE ──
let db = null;
let silinecekId = null;
let aramaZamanlayici = null;

// ── IndexedDB BAŞLAT ──
function dbBaslat() {
  return new Promise((resolve, reject) => {
    const istek = indexedDB.open(DB_ADI, DB_SURUM);

    istek.onupgradeneeded = (e) => {
      const veritabani = e.target.result;
      if (!veritabani.objectStoreNames.contains(STORE_ADI)) {
        const store = veritabani.createObjectStore(STORE_ADI, { keyPath: 'id', autoIncrement: true });
        store.createIndex('ad', 'ad', { unique: false });
      }
    };

    istek.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    istek.onerror = (e) => reject(e.target.error);
  });
}

// ── DOSYA KAYDET ──
function dosyaKaydet(dosyaObj) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ADI, 'readwrite');
    const store = tx.objectStore(STORE_ADI);
    const istek = store.add(dosyaObj);
    istek.onsuccess = () => resolve(istek.result);
    istek.onerror = () => reject(istek.error);
  });
}

// ── TÜM DOSYALARI GETİR ──
function tumDosyalariGetir() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ADI, 'readonly');
    const store = tx.objectStore(STORE_ADI);
    const istek = store.getAll();
    istek.onsuccess = () => resolve(istek.result);
    istek.onerror = () => reject(istek.error);
  });
}

// ── DOSYA SİL ──
function dosyaSil(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ADI, 'readwrite');
    const store = tx.objectStore(STORE_ADI);
    const istek = store.delete(id);
    istek.onsuccess = () => resolve();
    istek.onerror = () => reject(istek.error);
  });
}

// ── PDF METİN ÇIKAR ──
async function pdfMetinCikar(arrayBuffer) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let metin = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const sayfa = await pdf.getPage(i);
      const icerik = await sayfa.getTextContent();
      metin += icerik.items.map(item => item.str).join(' ') + '\n';
    }

    return metin;
  } catch (hata) {
    console.error('PDF okuma hatası:', hata);
    return '';
  }
}

// ── DOCX METİN ÇIKAR ──
async function docxMetinCikar(arrayBuffer) {
  try {
    const sonuc = await mammoth.extractRawText({ arrayBuffer });
    return sonuc.value;
  } catch (hata) {
    console.error('DOCX okuma hatası:', hata);
    return '';
  }
}

// ── BOYUT FORMAT ──
function boyutFormat(bayt) {
  if (bayt < 1024) return bayt + ' B';
  if (bayt < 1024 * 1024) return (bayt / 1024).toFixed(1) + ' KB';
  return (bayt / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── TARİH FORMAT ──
function tarihFormat(zaman) {
  return new Date(zaman).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

// ── BİLDİRİM GÖSTER ──
function bildirimGoster(mesaj, tip = 'basari') {
  const el = document.getElementById('bildirim');
  el.textContent = mesaj;
  el.className = 'bildirim ' + tip;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2800);
}

// ── DOSYA LİSTESİNİ GÜNCELLE ──
async function listeGuncelle() {
  const dosyalar = await tumDosyalariGetir();
  const liste = document.getElementById('dosyaListesi');
  const bosEkran = document.getElementById('bosEkran');
  const sayac = document.getElementById('dosyaSayisi');

  sayac.textContent = dosyalar.length + ' dosya';
  liste.innerHTML = '';

  if (dosyalar.length === 0) {
    bosEkran.style.display = 'block';
    return;
  }

  bosEkran.style.display = 'none';

  dosyalar.forEach(dosya => {
    const li = document.createElement('li');
    li.className = 'dosya-item';

    const isPdf = dosya.tur === 'pdf';
    li.innerHTML = `
      <div class="dosya-tip-ikon ${isPdf ? 'tip-pdf' : 'tip-docx'}">
        ${isPdf ? '📄' : '📝'}
      </div>
      <div class="dosya-bilgi">
        <div class="dosya-adi">${dosya.ad}</div>
        <div class="dosya-meta">${boyutFormat(dosya.boyut)} · ${tarihFormat(dosya.tarih)}</div>
      </div>
      <button class="sil-btn" data-id="${dosya.id}" title="Sil">🗑️</button>
    `;

    liste.appendChild(li);
  });

  // Silme butonları
  liste.querySelectorAll('.sil-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      silinecekId = Number(btn.dataset.id);
      const dosya = dosyalar.find(d => d.id === silinecekId);
      document.getElementById('silinecekDosyaAdi').textContent = dosya ? dosya.ad : '';
      document.getElementById('silmeModal').style.display = 'block';
      document.getElementById('modalArkaplan').style.display = 'block';
    });
  });
}

// ── PASAJ BÖLÜMÜ ──
function pasajCikar(metin, kelime, uzunluk = 120) {
  const kucukMetin = metin.toLowerCase();
  const kucukKelime = kelime.toLowerCase();
  const idx = kucukMetin.indexOf(kucukKelime);
  if (idx === -1) return null;

  const baslangic = Math.max(0, idx - 50);
  const bitis = Math.min(metin.length, idx + kelime.length + 70);
  let pasaj = (baslangic > 0 ? '...' : '') + metin.slice(baslangic, bitis) + (bitis < metin.length ? '...' : '');

  // Kelimeyi vurgula
  const regex = new RegExp(`(${kelime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  pasaj = pasaj.replace(regex, '<mark>$1</mark>');

  return pasaj;
}

// ── ARAMA ──
async function aramaYap(kelime) {
  const sonucEl = document.getElementById('aramaSonucu');

  if (!kelime || kelime.trim().length < 2) {
    sonucEl.style.display = 'none';
    return;
  }

  kelime = kelime.trim();
  const dosyalar = await tumDosyalariGetir();
  const eslesmeler = [];

  for (const dosya of dosyalar) {
    if (!dosya.metin) continue;
    const pasaj = pasajCikar(dosya.metin, kelime);
    if (pasaj) {
      eslesmeler.push({ dosya, pasaj });
    }
  }

  sonucEl.style.display = 'block';

  if (eslesmeler.length === 0) {
    sonucEl.innerHTML = `
      <div class="sonuc-baslik">Arama Sonuçları</div>
      <div class="sonuc-yok">🔍 "${kelime}" bulunamadı.</div>
    `;
    return;
  }

  let html = `<div class="sonuc-baslik">${eslesmeler.length} dosyada bulundu</div>`;

  eslesmeler.forEach(({ dosya, pasaj }) => {
    const ikon = dosya.tur === 'pdf' ? '📄' : '📝';
    html += `
      <div class="sonuc-item">
        <div class="sonuc-dosya-adi">${ikon} ${dosya.ad}</div>
        <div class="sonuc-pasaj">${pasaj}</div>
      </div>
    `;
  });

  sonucEl.innerHTML = html;
}

// ── DOSYA YÜKLEYİCİ ──
async function dosyalariYukle(dosyalar) {
  const ilerlemeEl = document.getElementById('yuklemeIlerleme');
  const dolumEl = document.getElementById('ilerlemeDolum');
  const yaziEl = document.getElementById('yuklemeYazisi');

  ilerlemeEl.style.display = 'flex';

  for (let i = 0; i < dosyalar.length; i++) {
    const dosya = dosyalar[i];
    const yuzde = Math.round(((i) / dosyalar.length) * 100);

    dolumEl.style.width = yuzde + '%';
    yaziEl.textContent = `İşleniyor: ${dosya.name}`;

    try {
      const arrayBuffer = await dosya.arrayBuffer();
      let metin = '';
      let tur = '';

      if (dosya.name.toLowerCase().endsWith('.pdf')) {
        tur = 'pdf';
        metin = await pdfMetinCikar(arrayBuffer);
      } else if (dosya.name.toLowerCase().endsWith('.docx')) {
        tur = 'docx';
        metin = await docxMetinCikar(arrayBuffer);
      }

      await dosyaKaydet({
        ad: dosya.name,
        boyut: dosya.size,
        tur: tur,
        metin: metin,
        tarih: Date.now()
      });

    } catch (hata) {
      console.error('Yükleme hatası:', hata);
      bildirimGoster(`Hata: ${dosya.name} yüklenemedi.`, 'hata');
    }
  }

  dolumEl.style.width = '100%';
  yaziEl.textContent = 'Tamamlandı!';

  setTimeout(() => {
    ilerlemeEl.style.display = 'none';
    dolumEl.style.width = '0%';
  }, 1000);

  await listeGuncelle();
  bildirimGoster(`${dosyalar.length} dosya yüklendi ✓`, 'basari');
}

// ── UYGULAMA BAŞLAT ──
async function uygulamaBaslat() {
  await dbBaslat();
  await listeGuncelle();

  // Dosya seçici
  const secici = document.getElementById('dosyaSecici');
  secici.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await dosyalariYukle(Array.from(e.target.files));
      secici.value = '';
    }
  });

  // Arama
  const aramaInput = document.getElementById('aramaInput');
  const temizleBtn = document.getElementById('aramayiTemizle');

  aramaInput.addEventListener('input', (e) => {
    const deger = e.target.value;
    temizleBtn.style.display = deger ? 'block' : 'none';

    clearTimeout(aramaZamanlayici);
    aramaZamanlayici = setTimeout(() => aramaYap(deger), 300);
  });

  temizleBtn.addEventListener('click', () => {
    aramaInput.value = '';
    temizleBtn.style.display = 'none';
    document.getElementById('aramaSonucu').style.display = 'none';
    aramaInput.focus();
  });

  // Silme modal
  document.getElementById('silmeIptal').addEventListener('click', () => {
    document.getElementById('silmeModal').style.display = 'none';
    document.getElementById('modalArkaplan').style.display = 'none';
    silinecekId = null;
  });

  document.getElementById('modalArkaplan').addEventListener('click', () => {
    document.getElementById('silmeModal').style.display = 'none';
    document.getElementById('modalArkaplan').style.display = 'none';
    silinecekId = null;
  });

  document.getElementById('silmeOnayla').addEventListener('click', async () => {
    if (silinecekId !== null) {
      await dosyaSil(silinecekId);
      document.getElementById('silmeModal').style.display = 'none';
      document.getElementById('modalArkaplan').style.display = 'none';
      silinecekId = null;
      await listeGuncelle();
      bildirimGoster('Dosya silindi.', 'basari');

      // Arama varsa yenile
      const kelime = document.getElementById('aramaInput').value;
      if (kelime) aramaYap(kelime);
    }
  });

  // Service Worker kaydet
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (e) {
      console.log('SW kaydedilemedi:', e);
    }
  }
}

document.addEventListener('DOMContentLoaded', uygulamaBaslat);