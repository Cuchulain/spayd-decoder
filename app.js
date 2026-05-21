(() => {
  'use strict';

  const FIELD_LABELS = {
    ACC: 'IBAN',
    ALT_ACC: 'Alternativní účty',
    AM: 'Částka',
    CC: 'Měna',
    RF: 'Reference plátce',
    RN: 'Jméno příjemce',
    DT: 'Datum splatnosti',
    PT: 'Typ platby',
    MSG: 'Zpráva pro příjemce',
    'X-VS': 'Variabilní symbol',
    'X-SS': 'Specifický symbol',
    'X-KS': 'Konstantní symbol',
    'X-PER': 'Opakování (dny)',
    'X-ID': 'ID platby',
    'X-URL': 'URL',
    NT: 'Notifikace',
    NTA: 'Adresa notifikace',
  };

  const FIELD_ORDER = [
    'ACC_DERIVED', 'ACC', 'ACC_BIC', 'AM', 'CC',
    'X-VS', 'X-SS', 'X-KS',
    'MSG', 'RN', 'DT', 'PT', 'RF',
    'ALT_ACC', 'X-PER', 'X-ID', 'X-URL', 'NT', 'NTA',
  ];

  const els = {
    tabCamera: document.getElementById('tab-camera'),
    tabUpload: document.getElementById('tab-upload'),
    panelCamera: document.getElementById('panel-camera'),
    panelUpload: document.getElementById('panel-upload'),
    video: document.getElementById('video'),
    cameraCanvas: document.getElementById('camera-canvas'),
    btnStart: document.getElementById('btn-start'),
    btnStop: document.getElementById('btn-stop'),
    cameraStatus: document.getElementById('camera-status'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    uploadStatus: document.getElementById('upload-status'),
    resultSection: document.getElementById('result-section'),
    resultFields: document.getElementById('result-fields'),
    rawSpayd: document.getElementById('raw-spayd'),
    btnReset: document.getElementById('btn-reset'),
    errorSection: document.getElementById('error-section'),
    toast: document.getElementById('toast'),
  };

  let stream = null;
  let scanning = false;
  let rafId = null;

  // ===== Tabs =====
  els.tabCamera.addEventListener('click', () => setTab('camera'));
  els.tabUpload.addEventListener('click', () => setTab('upload'));

  function setTab(which) {
    const isCamera = which === 'camera';
    els.tabCamera.classList.toggle('active', isCamera);
    els.tabUpload.classList.toggle('active', !isCamera);
    els.tabCamera.setAttribute('aria-selected', String(isCamera));
    els.tabUpload.setAttribute('aria-selected', String(!isCamera));
    els.panelCamera.hidden = !isCamera;
    els.panelUpload.hidden = isCamera;
    if (!isCamera) stopCamera();
  }

  // ===== Camera =====
  els.btnStart.addEventListener('click', startCamera);
  els.btnStop.addEventListener('click', stopCamera);

  async function startCamera() {
    clearStatus(els.cameraStatus);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus(els.cameraStatus, 'Prohlížeč nepodporuje přístup ke kameře.', 'error');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      els.video.srcObject = stream;
      await els.video.play();
      els.btnStart.hidden = true;
      els.btnStop.hidden = false;
      setStatus(els.cameraStatus, 'Skenuji…');
      scanning = true;
      tick();
    } catch (err) {
      setStatus(els.cameraStatus, 'Nelze spustit kameru: ' + (err.message || err), 'error');
    }
  }

  function stopCamera() {
    scanning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    els.video.srcObject = null;
    els.btnStart.hidden = false;
    els.btnStop.hidden = true;
    clearStatus(els.cameraStatus);
  }

  function tick() {
    if (!scanning) return;
    if (els.video.readyState === els.video.HAVE_ENOUGH_DATA) {
      const w = els.video.videoWidth;
      const h = els.video.videoHeight;
      els.cameraCanvas.width = w;
      els.cameraCanvas.height = h;
      const ctx = els.cameraCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(els.video, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        handleQrText(code.data);
        stopCamera();
        return;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  // ===== Upload =====
  els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFile(file);
  });

  ['dragenter', 'dragover'].forEach(ev =>
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropZone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach(ev =>
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove('dragover');
    })
  );
  els.dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    clearStatus(els.uploadStatus);
    if (!file.type.startsWith('image/')) {
      setStatus(els.uploadStatus, 'Vyber prosím obrázkový soubor.', 'error');
      return;
    }
    setStatus(els.uploadStatus, 'Načítám obrázek…');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, canvas.width, canvas.height);
        if (code && code.data) {
          clearStatus(els.uploadStatus);
          handleQrText(code.data);
        } else {
          setStatus(els.uploadStatus, 'V obrázku se nepodařilo najít QR kód.', 'error');
        }
      };
      img.onerror = () => setStatus(els.uploadStatus, 'Obrázek se nepodařilo načíst.', 'error');
      img.src = reader.result;
    };
    reader.onerror = () => setStatus(els.uploadStatus, 'Soubor se nepodařilo načíst.', 'error');
    reader.readAsDataURL(file);
  }

  // ===== SPAYD parser =====
  function parseSpayd(text) {
    const trimmed = text.trim();
    if (!/^SPD\*/i.test(trimmed)) {
      throw new Error('QR kód nevypadá jako SPAYD (chybí prefix SPD*).');
    }
    const parts = trimmed.split('*');
    // parts[0] === 'SPD', parts[1] === version (např. '1.0')
    const version = parts[1] || '';
    const fields = {};
    for (let i = 2; i < parts.length; i++) {
      const token = parts[i];
      if (!token) continue;
      const colon = token.indexOf(':');
      if (colon === -1) continue;
      const key = token.slice(0, colon).toUpperCase();
      const rawValue = token.slice(colon + 1);
      let value;
      try {
        value = decodeURIComponent(rawValue.replace(/\+/g, '%20'));
      } catch {
        value = rawValue;
      }
      fields[key] = value;
    }
    return { version, fields };
  }

  // CZ IBAN: CZkk BBBB PPPP PPCC CCCC CCCC (24 znaků celkem)
  function ibanToCzechAccount(iban) {
    if (!iban) return null;
    const clean = iban.replace(/\s+/g, '').toUpperCase();
    if (!/^CZ\d{22}$/.test(clean)) return null;
    const bank = clean.slice(4, 8);
    const prefixRaw = clean.slice(8, 14);
    const accountRaw = clean.slice(14, 24);
    const prefix = prefixRaw.replace(/^0+/, '');
    const account = accountRaw.replace(/^0+/, '') || '0';
    return (prefix ? prefix + '-' : '') + account + '/' + bank;
  }

  function formatSpaydDate(dt) {
    if (!/^\d{8}$/.test(dt)) return dt;
    return `${dt.slice(6, 8)}.${dt.slice(4, 6)}.${dt.slice(0, 4)}`;
  }

  function formatAmount(am, cc) {
    if (!am) return am;
    const num = Number(am);
    if (Number.isNaN(num)) return am;
    const formatted = num.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return cc ? `${formatted} ${cc}` : formatted;
  }

  // ===== Rendering =====
  function handleQrText(text) {
    hideError();
    let parsed;
    try {
      parsed = parseSpayd(text);
    } catch (err) {
      showError(err.message + ' Obsah: ' + text);
      return;
    }
    renderResult(parsed, text);
  }

  function renderResult(parsed, rawText) {
    const { fields } = parsed;
    const cards = [];

    // IBAN + BIC
    if (fields.ACC) {
      const [iban, bic] = fields.ACC.split('+');
      const czAccount = ibanToCzechAccount(iban);
      if (czAccount) {
        cards.push({ order: 'ACC_DERIVED', label: 'Číslo účtu (CZ)', value: czAccount });
      }
      cards.push({ order: 'ACC', label: FIELD_LABELS.ACC, value: iban });
      if (bic) {
        cards.push({ order: 'ACC_BIC', label: 'BIC / SWIFT', value: bic });
      }
    }

    // Částka — speciální formátování s měnou, ale kopírovat jen číslo
    if (fields.AM) {
      cards.push({
        order: 'AM',
        label: FIELD_LABELS.AM,
        value: formatAmount(fields.AM, fields.CC),
        copyValue: fields.AM,
      });
    }

    if (fields.CC) {
      cards.push({ order: 'CC', label: FIELD_LABELS.CC, value: fields.CC });
    }

    // Datum
    if (fields.DT) {
      cards.push({
        order: 'DT',
        label: FIELD_LABELS.DT,
        value: formatSpaydDate(fields.DT),
        copyValue: formatSpaydDate(fields.DT),
      });
    }

    // Ostatní známá pole
    const handled = new Set(['ACC', 'AM', 'CC', 'DT']);
    for (const key of Object.keys(fields)) {
      if (handled.has(key)) continue;
      const label = FIELD_LABELS[key] || key;
      cards.push({ order: key, label, value: fields[key] });
    }

    // Setřídit dle FIELD_ORDER
    const indexOf = (o) => {
      const i = FIELD_ORDER.indexOf(o);
      return i === -1 ? FIELD_ORDER.length + 1 : i;
    };
    cards.sort((a, b) => indexOf(a.order) - indexOf(b.order));

    els.resultFields.innerHTML = '';
    for (const card of cards) {
      els.resultFields.appendChild(buildFieldCard(card.label, card.value, card.copyValue ?? card.value));
    }

    els.rawSpayd.textContent = rawText;
    els.resultSection.hidden = false;
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildFieldCard(label, value, copyValue) {
    const card = document.createElement('div');
    card.className = 'field-card';

    const body = document.createElement('div');
    body.className = 'field-body';
    const labelEl = document.createElement('span');
    labelEl.className = 'field-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'field-value';
    valueEl.textContent = value;
    body.appendChild(labelEl);
    body.appendChild(valueEl);

    const btn = document.createElement('button');
    btn.className = 'btn copy';
    btn.type = 'button';
    btn.textContent = 'Kopírovat';
    btn.addEventListener('click', () => copyToClipboard(String(copyValue), label));

    card.appendChild(body);
    card.appendChild(btn);
    return card;
  }

  // ===== Copy & toast =====
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList && target.classList.contains('copy') && target.dataset.copyTarget) {
      const node = document.getElementById(target.dataset.copyTarget);
      if (node) copyToClipboard(node.textContent, 'Surový SPAYD');
    }
  });

  async function copyToClipboard(text, label) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast(`Zkopírováno: ${label}`);
    } catch (err) {
      showToast('Kopírování selhalo');
    }
  }

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 1800);
  }

  // ===== Reset & errors =====
  els.btnReset.addEventListener('click', () => {
    els.resultSection.hidden = true;
    els.resultFields.innerHTML = '';
    els.rawSpayd.textContent = '';
    els.fileInput.value = '';
    hideError();
  });

  function setStatus(el, msg, kind) {
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }
  function clearStatus(el) {
    el.textContent = '';
    el.className = 'status';
  }
  function showError(msg) {
    els.errorSection.textContent = msg;
    els.errorSection.hidden = false;
  }
  function hideError() {
    els.errorSection.textContent = '';
    els.errorSection.hidden = true;
  }
})();
