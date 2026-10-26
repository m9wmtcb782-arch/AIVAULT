/* Content sniff for ebook formats. Extension is hint only. */
(function (root) {
  "use strict";
  var LABELS = { pdf: "PDF", powerpoint: "PowerPoint", word: "Word", other: "其他檔案" };

  function extOf(name) {
    if (!name) return null;
    var m = String(name).toLowerCase().match(/(\.[a-z0-9]+)$/);
    return m ? m[1] : null;
  }

  function isOle(u8) {
    return u8.length >= 8 && u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0;
  }
  function isZip(u8) {
    return u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07);
  }
  function isPdf(u8) {
    return u8.length >= 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46;
  }

  function detectFromBytes(u8, filename) {
    var ext = extOf(filename);
    if (isPdf(u8)) {
      return { bucket: "pdf", label: LABELS.pdf, mime: "application/pdf", confidence: 0.99, rationale: "magic:%PDF", extension_hint: ext, sniff_matched: true };
    }
    if (isZip(u8)) {
      // Browser path: caller may pass zipHint: 'word'|'ppt' after JSZip inspect
      return { bucket: "other", label: LABELS.other, mime: "application/zip", confidence: 0.55, rationale: "ZIP magic; inspect entries via detectZipEntries", extension_hint: ext, sniff_matched: true, needs_zip_inspect: true };
    }
    if (isOle(u8)) {
      if (ext === ".ppt" || ext === ".pps") {
        return { bucket: "powerpoint", label: LABELS.powerpoint, mime: "application/vnd.ms-powerpoint", confidence: 0.75, rationale: "OLE+.ppt hint", extension_hint: ext, sniff_matched: true };
      }
      if (ext === ".doc") {
        return { bucket: "word", label: LABELS.word, mime: "application/msword", confidence: 0.75, rationale: "OLE+.doc hint", extension_hint: ext, sniff_matched: true };
      }
      return { bucket: "other", label: LABELS.other, mime: "application/x-ole-storage", confidence: 0.5, rationale: "OLE undifferentiated", extension_hint: ext, sniff_matched: true };
    }
    if (ext === ".pdf") return { bucket: "pdf", label: LABELS.pdf, mime: "application/pdf", confidence: 0.35, rationale: "extension-only", extension_hint: ext, sniff_matched: false };
    if (ext === ".pptx" || ext === ".ppt") return { bucket: "powerpoint", label: LABELS.powerpoint, mime: "application/vnd.ms-powerpoint", confidence: 0.35, rationale: "extension-only", extension_hint: ext, sniff_matched: false };
    if (ext === ".docx" || ext === ".doc") return { bucket: "word", label: LABELS.word, mime: "application/msword", confidence: 0.35, rationale: "extension-only", extension_hint: ext, sniff_matched: false };
    return { bucket: "other", label: LABELS.other, mime: "application/octet-stream", confidence: 0.9, rationale: "no known magic", extension_hint: ext, sniff_matched: false };
  }

  function refineZip(base, entryNames) {
    var joined = (entryNames || []).join("\n");
    if (/(^|\/)word\//.test(joined)) {
      return Object.assign({}, base, { bucket: "word", label: LABELS.word, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", confidence: 0.97, rationale: "OOXML word/", needs_zip_inspect: false });
    }
    if (/(^|\/)ppt\//.test(joined) || /presentation/.test(joined)) {
      return Object.assign({}, base, { bucket: "powerpoint", label: LABELS.powerpoint, mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", confidence: 0.97, rationale: "OOXML ppt/", needs_zip_inspect: false });
    }
    return Object.assign({}, base, { rationale: "ZIP without word/ppt", confidence: 0.7, needs_zip_inspect: false });
  }

  root.AivaultFormatDetect = { detectFromBytes: detectFromBytes, refineZip: refineZip, LABELS: LABELS };
})(typeof window !== "undefined" ? window : globalThis);
