// Fotos fürs Hochladen vorbereiten: verkleinern, als JPEG speichern,
// mehrere Seiten zu einem PDF zusammenfügen. Alles im Browser, ohne Zusatzbibliothek.

const MAX_EDGE = 2400;        // lange Kante in Pixeln, reicht für gut lesbare Briefe
const JPEG_QUALITY = 0.85;
const KEEP_ORIGINAL_BYTES = 3 * 1024 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Dieses Bild kann der Browser nicht lesen. Bitte als JPG, PNG oder PDF speichern.'));
    };
    img.src = url;
  });
}

// Bild auf höchstens MAX_EDGE verkleinern und als JPEG ausgeben.
// Die Ausrichtung aus den Kameradaten berücksichtigt der Browser beim Zeichnen selbst.
export async function toJpeg(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparente PNGs bekommen weißen Grund
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Das Bild konnte nicht umgewandelt werden.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
  return { blob, width, height, scaled: scale < 1 };
}

// Ein einzelnes Bild: klein genug und JPG/PNG → unverändert, sonst verkleinertes JPEG.
export async function prepareSingleImage(file) {
  const page = await toJpeg(file);
  const keep = !page.scaled && file.size <= KEEP_ORIGINAL_BYTES && /^image\/(jpeg|png)$/.test(file.type);
  if (keep) return { blob: file, type: file.type, ext: file.type === 'image/png' ? 'png' : 'jpg' };
  return { blob: page.blob, type: 'image/jpeg', ext: 'jpg' };
}

// Mehrere Fotos → ein PDF, je Foto eine Seite in A4-Breite.
export async function imagesToPdf(files) {
  const pages = [];
  for (const file of files) pages.push(await toJpeg(file));
  return jpegsToPdf(pages);
}

// Schreibt ein minimales PDF 1.4 mit eingebetteten JPEGs (DCTDecode).
// Aufbau: 1 Katalog, 2 Seitenbaum, dann je Seite: Seite, Inhalt, Bild.
async function jpegsToPdf(pages) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;

  const push = (part) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (number, ...parts) => {
    offsets[number] = length;
    push(`${number} 0 obj\n`);
    parts.forEach(push);
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%âãÏÓ\n');
  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  for (let i = 0; i < pages.length; i++) {
    const { blob, width, height } = pages[i];
    const data = new Uint8Array(await blob.arrayBuffer());
    const pageWidth = 595.28; // A4-Breite in Punkt
    const pageHeight = Number((pageWidth * height / width).toFixed(2));
    const n = 3 + 3 * i;
    object(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] `
      + `/Resources << /XObject << /Im${i} ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im${i} Do Q`;
    object(n + 1, `<< /Length ${content.length} >>\nstream\n`, content, '\nendstream');
    object(n + 2, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} `
      + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
    data, '\nendstream');
  }

  const xrefOffset = length;
  const size = 3 + 3 * pages.length;
  push(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let k = 1; k < size; k++) push(`${String(offsets[k]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}
