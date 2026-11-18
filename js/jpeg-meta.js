// Ajoute au JPEG :
//  - XMP "GPano" : Google Photos, Drive, Facebook, Kuula… reconnaissent la photo comme 360.
//  - EXIF : date, logiciel et position GPS (pour la cartographie).

export async function addPanoMetadata(blob, { width, height, lat, lon, alt, date = new Date(), heading }) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return blob;
  // On saute SOI et un éventuel APP0 (JFIF) pour insérer nos segments en tête.
  let pos = 2;
  if (buf[2] === 0xff && buf[3] === 0xe0) pos = 4 + ((buf[4] << 8) | buf[5]);
  const exif = buildExif({ lat, lon, alt, date });
  const xmp = buildXmp(width, height, heading);
  return new Blob([buf.subarray(0, 2), exif, xmp, buf.subarray(pos)], { type: 'image/jpeg' });
}

function segment(marker, payload) {
  const len = payload.length + 2;
  if (len > 0xffff) throw new Error('segment trop long');
  const out = new Uint8Array(len + 2);
  out[0] = 0xff; out[1] = marker; out[2] = len >> 8; out[3] = len & 0xff;
  out.set(payload, 4);
  return out;
}

function buildXmp(w, h, heading) {
  const head = heading != null ? ` GPano:PoseHeadingDegrees="${heading.toFixed(1)}"` : '';
  const xml = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/" GPano:ProjectionType="equirectangular" GPano:UsePanoramaViewer="True" GPano:CroppedAreaImageWidthPixels="${w}" GPano:CroppedAreaImageHeightPixels="${h}" GPano:FullPanoWidthPixels="${w}" GPano:FullPanoHeightPixels="${h}" GPano:CroppedAreaLeftPixels="0" GPano:CroppedAreaTopPixels="0" GPano:StitchingSoftware="Green Quest 360"${head}/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  const ns = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
  const body = new TextEncoder().encode(xml);
  const p = new Uint8Array(ns.length + body.length); p.set(ns); p.set(body, ns.length);
  return segment(0xe1, p);
}

// --- EXIF minimal (TIFF big-endian) ---
function buildExif({ lat, lon, alt, date }) {
  const pad = (n) => String(n).padStart(2, '0');
  const dt = `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}\0`;
  const hasGps = Number.isFinite(lat) && Number.isFinite(lon);

  // Chaque entrée : [tag, type, count, valeur (octets)]  types : 1 BYTE, 2 ASCII, 3 SHORT, 4 LONG, 5 RATIONAL
  const ascii = (s) => new TextEncoder().encode(s);
  const rationals = (arr) => { const b = new Uint8Array(arr.length * 8); const v = new DataView(b.buffer); arr.forEach(([n, d], i) => { v.setUint32(i * 8, n); v.setUint32(i * 8 + 4, d); }); return b; };
  const dms = (deg) => { deg = Math.abs(deg); const d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60 * 10000); return [[d, 1], [m, 1], [s, 10000]]; };

  const ifd0 = [
    [0x0131, 2, ascii('Green Quest 360\0')],
    [0x0132, 2, ascii(dt)],
  ];
  if (hasGps) ifd0.push([0x8825, 4, null]); // pointeur GPS, rempli plus bas
  const gps = hasGps ? [
    [0x0000, 1, new Uint8Array([2, 3, 0, 0])],
    [0x0001, 2, ascii(lat >= 0 ? 'N\0' : 'S\0')],
    [0x0002, 5, rationals(dms(lat))],
    [0x0003, 2, ascii(lon >= 0 ? 'E\0' : 'W\0')],
    [0x0004, 5, rationals(dms(lon))],
  ] : [];
  if (hasGps && Number.isFinite(alt)) {
    gps.push([0x0005, 1, new Uint8Array([alt < 0 ? 1 : 0])]);
    gps.push([0x0006, 5, rationals([[Math.round(Math.abs(alt) * 100), 100]])]);
  }

  const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };
  const ifdSize = (entries) => 2 + entries.length * 12 + 4;
  const dataSize = (entries) => entries.reduce((s, [, , v]) => s + (v && v.length > 4 ? v.length + (v.length & 1) : 0), 0);

  const ifd0Off = 8;
  const ifd0DataOff = ifd0Off + ifdSize(ifd0);
  const gpsOff = ifd0DataOff + dataSize(ifd0);
  const total = gpsOff + (hasGps ? ifdSize(gps) + dataSize(gps) : 0);

  const tiff = new Uint8Array(total), v = new DataView(tiff.buffer);
  tiff.set([0x4d, 0x4d, 0x00, 0x2a]); v.setUint32(4, ifd0Off);

  const writeIfd = (entries, off, dataOff) => {
    v.setUint16(off, entries.length);
    let p = off + 2, d = dataOff;
    for (const [tag, type, val] of entries) {
      v.setUint16(p, tag); v.setUint16(p + 2, type);
      if (tag === 0x8825) { v.setUint32(p + 4, 1); v.setUint32(p + 8, gpsOff); p += 12; continue; }
      const count = val.length / typeSize[type];
      v.setUint32(p + 4, count);
      if (val.length <= 4) tiff.set(val, p + 8);
      else { v.setUint32(p + 8, d); tiff.set(val, d); d += val.length + (val.length & 1); }
      p += 12;
    }
    v.setUint32(p, 0);
  };
  writeIfd(ifd0, ifd0Off, ifd0DataOff);
  if (hasGps) writeIfd(gps, gpsOff, gpsOff + ifdSize(gps));

  const head = new TextEncoder().encode('Exif\0\0');
  const payload = new Uint8Array(head.length + tiff.length);
  payload.set(head); payload.set(tiff, head.length);
  return segment(0xe1, payload);
}
