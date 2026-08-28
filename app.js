document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const modelSelect = document.getElementById('modelSelect');
  const customModelInput = document.getElementById('customModel');
  const bgToleranceInput = document.getElementById('bgTolerance');
  const toleranceVal = document.getElementById('toleranceVal');
  const cropPaddingInput = document.getElementById('cropPadding');
  const paddingVal = document.getElementById('paddingVal');
  const extendedWorkflowCheckbox = document.getElementById('extendedWorkflow');
  
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const batchControls = document.getElementById('batchControls');
  const filesCountSpan = document.getElementById('filesCount');
  const filesListDiv = document.getElementById('filesList');
  const processBtn = document.getElementById('processBtn');
  
  const loadingContainer = document.getElementById('loadingContainer');
  const loadingText = document.getElementById('loadingText');
  const resultsCard = document.getElementById('resultsCard');
  const batchResultsList = document.getElementById('batchResultsList');
  const downloadZipBtn = document.getElementById('downloadZipBtn');

  // Modals
  const regenerateModal = document.getElementById('regenerateModal');
  const closeRegenModal = document.getElementById('closeRegenModal');
  const regenPromptTextarea = document.getElementById('regenPrompt');
  const submitRegenBtn = document.getElementById('submitRegenBtn');
  const cancelRegenBtn = document.getElementById('cancelRegenBtn');

  const editModal = document.getElementById('editModal');
  const closeEditModal = document.getElementById('closeEditModal');
  const modalEyeImg = document.getElementById('modalEyeImg');
  const editPromptTextarea = document.getElementById('editPrompt');
  const geminiResponseBox = document.getElementById('geminiResponseBox');
  const responseTextDiv = document.getElementById('responseText');
  const submitEditBtn = document.getElementById('submitEditBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');

  // App State
  let filesQueue = []; // Array of file objects
  let currentRegenFileId = null;
  let currentEditCanvas = null;

  const DETECTION_PROMPT = `Analyze this image containing doll, cartoon, or anime eyes drawings.
Identify and detect the exact bounding box for EVERY individual eye in pixel coordinates (whether there is a single eye, one pair, or multiple pairs/sheets of eyes).
The original image dimensions are: width={width}, height={height}.

Return the coordinates strictly as a valid JSON object:
{
  "eyes": [
    {"ymin": int, "xmin": int, "ymax": int, "xmax": int, "label": "Eye 1"}
  ]
}
Do not return any other text, explanations, or code formatting. Just the JSON object.`;

  // Load configuration from localStorage
  if (localStorage.getItem('gemini_api_key')) {
    apiKeyInput.value = localStorage.getItem('gemini_api_key');
  }
  if (localStorage.getItem('gemini_model')) {
    const savedModel = localStorage.getItem('gemini_model');
    if ([...modelSelect.options].some(opt => opt.value === savedModel)) {
      modelSelect.value = savedModel;
    } else {
      modelSelect.value = 'custom';
      customModelInput.value = savedModel;
      customModelInput.classList.remove('hidden');
    }
  }
  if (localStorage.getItem('gemini_extended_workflow') === 'true') {
    extendedWorkflowCheckbox.checked = true;
  }

  // Configuration Event Listeners
  apiKeyInput.addEventListener('input', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value.trim());
  });

  modelSelect.addEventListener('change', () => {
    const val = modelSelect.value;
    if (val === 'custom') {
      customModelInput.classList.remove('hidden');
      customModelInput.focus();
    } else {
      customModelInput.classList.add('hidden');
      localStorage.setItem('gemini_model', val);
    }
  });

  customModelInput.addEventListener('input', () => {
    localStorage.setItem('gemini_model', customModelInput.value.trim());
  });

  extendedWorkflowCheckbox.addEventListener('change', () => {
    localStorage.setItem('gemini_extended_workflow', extendedWorkflowCheckbox.checked);
    // Reprocess completed files when switching workflow
    filesQueue.forEach(item => {
      item.isExtended = extendedWorkflowCheckbox.checked;
      if (item.status === 'completed') {
        processAllVariants(item);
      }
    });
    if (filesQueue.some(item => item.status === 'completed')) {
      renderResults();
    }
  });

  toggleApiKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKeyBtn.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyBtn.textContent = '👁️';
    }
  });

  bgToleranceInput.addEventListener('input', () => {
    toleranceVal.textContent = bgToleranceInput.value;
    filesQueue.forEach(item => {
      if (item.status === 'completed') {
        reprocessAllVariants(item);
      }
    });
  });

  cropPaddingInput.addEventListener('input', () => {
    paddingVal.textContent = cropPaddingInput.value + 'px';
    filesQueue.forEach(item => {
      if (item.status === 'completed') {
        applyPaddingAndReprocess(item);
      }
    });
  });

  // File Upload Handlers
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files.length > 0) {
      handleFiles(dt.files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFiles(fileInput.files);
    }
  });

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const fileId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const base64 = e.target.result;
        const imgEl = new Image();
        imgEl.src = base64;
        
        imgEl.onload = () => {
          const isExtended = extendedWorkflowCheckbox.checked;

          filesQueue.push({
            id: fileId,
            name: file.name,
            file: file,
            base64: base64,
            status: 'pending',
            isExtended: isExtended,
            rawEyes: [],      // Raw bounding box list from Gemini
            coords: [],       // Bounding box list with padding & user adjustments
            originalImage: imgEl,
            promptUsed: DETECTION_PROMPT.replace('{width}', imgEl.naturalWidth).replace('{height}', imgEl.naturalHeight),
            processedEyes: [] // Processed individual eyes with transparent canvases
          });
          renderFilesList();
        };
      };
      
      reader.readAsDataURL(file);
    });

    batchControls.classList.remove('hidden');
    resultsCard.classList.add('hidden');
  }

  function renderFilesList() {
    filesCountSpan.textContent = filesQueue.length;
    filesListDiv.innerHTML = '';
    
    filesQueue.forEach(item => {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `
        <span class="file-name" title="${item.name}">${item.name}</span>
        <span class="status-badge ${item.status}">${item.status}</span>
      `;
      filesListDiv.appendChild(row);
    });
  }

  function getActiveModel() {
    if (modelSelect.value === 'custom') {
      return customModelInput.value.trim() || 'gemini-1.5-flash';
    }
    return modelSelect.value;
  }

  // Start Batch Processing
  processBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert('Please enter your Gemini API Key first.');
      apiKeyInput.focus();
      return;
    }

    processBtn.disabled = true;
    loadingContainer.classList.remove('hidden');
    resultsCard.classList.add('hidden');
    batchResultsList.innerHTML = '';

    for (let i = 0; i < filesQueue.length; i++) {
      const item = filesQueue[i];
      if (item.status === 'completed') continue;
      
      item.status = 'processing';
      renderFilesList();
      loadingText.textContent = `Processing ${i + 1} of ${filesQueue.length}: ${item.name}...`;

      try {
        await processSingleFile(item, apiKey);
        item.status = 'completed';
      } catch (err) {
        console.error(err);
        item.status = 'failed';
      }
      renderFilesList();
    }

    loadingContainer.classList.add('hidden');
    processBtn.disabled = false;
    
    if (filesQueue.some(item => item.status === 'completed')) {
      renderResults();
    }
  });

  async function processSingleFile(item, apiKey) {
    const model = getActiveModel();
    const base64Data = item.base64.split(',')[1];
    const mimeType = item.base64.split(',')[0].split(':')[1].split(';')[0];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: item.promptUsed },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP error ${response.status}`);
    }

    const result = await response.json();
    const textResponse = result.candidates[0].content.parts[0].text;
    const parsedJson = JSON.parse(textResponse.trim());

    // Normalize coordinates into an array of individual eye bounding boxes
    const imgW = item.originalImage.naturalWidth;
    const imgH = item.originalImage.naturalHeight;
    item.rawEyes = normalizeCoordinates(parsedJson, imgW, imgH);
    
    // Apply coordinates padding
    applyPadding(item);

    // Process canvases for individual eyes & variants
    processAllVariants(item);
  }

  function normalizeCoordinates(raw, imgW, imgH) {
    let eyes = [];
    if (raw && Array.isArray(raw.eyes)) {
      eyes = raw.eyes;
    } else if (raw && raw.left_eye && raw.right_eye) {
      eyes = [
        { ...raw.left_eye, label: 'Left Eye' },
        { ...raw.right_eye, label: 'Right Eye' }
      ];
    } else if (raw && Array.isArray(raw.pairs)) {
      raw.pairs.forEach((p, idx) => {
        const midX = Math.round((p.xmin + p.xmax) / 2);
        eyes.push({
          ymin: p.ymin,
          xmin: p.xmin,
          ymax: p.ymax,
          xmax: midX,
          label: `Pair ${idx + 1} Left`
        });
        eyes.push({
          ymin: p.ymin,
          xmin: midX,
          ymax: p.ymax,
          xmax: p.xmax,
          label: `Pair ${idx + 1} Right`
        });
      });
    } else if (Array.isArray(raw)) {
      eyes = raw;
    }

    if (eyes.length === 0) {
      eyes = [{
        ymin: Math.round(imgH * 0.1),
        xmin: Math.round(imgW * 0.1),
        ymax: Math.round(imgH * 0.9),
        xmax: Math.round(imgW * 0.9),
        label: 'Eye 1'
      }];
    }

    return eyes.map((e, idx) => ({
      id: 'eye_' + (idx + 1) + '_' + Math.random().toString(36).substr(2, 6),
      ymin: Math.max(0, Math.min(imgH, Math.round(e.ymin ?? 0))),
      xmin: Math.max(0, Math.min(imgW, Math.round(e.xmin ?? 0))),
      ymax: Math.max(0, Math.min(imgH, Math.round(e.ymax ?? imgH))),
      xmax: Math.max(0, Math.min(imgW, Math.round(e.xmax ?? imgW))),
      label: e.label || `Eye ${idx + 1}`
    }));
  }

  function applyPadding(item) {
    const pad = parseInt(cropPaddingInput.value) || 0;
    const imgW = item.originalImage.naturalWidth;
    const imgH = item.originalImage.naturalHeight;

    item.coords = (item.rawEyes || []).map(e => ({
      id: e.id,
      label: e.label,
      ymin: Math.max(0, e.ymin - pad),
      xmin: Math.max(0, e.xmin - pad),
      ymax: Math.min(imgH, e.ymax + pad),
      xmax: Math.min(imgW, e.xmax + pad)
    }));
  }

  function applyPaddingAndReprocess(item) {
    applyPadding(item);
    rebuildOverlayBoxes(item);
    reprocessAllVariants(item);
  }

  // Generates transparent canvases for every individual eye + color variants
  function processAllVariants(item) {
    item.processedEyes = [];
    const imgEl = item.originalImage;
    const isExtended = item.isExtended;

    (item.coords || []).forEach((box, idx) => {
      const baseCanvas = processEyeCanvas(imgEl, box);

      if (isExtended) {
        // HD 2x Upscale + Sharpen
        const hdCanvas = upscaleAndSharpen(baseCanvas);

        const variants = [
          { name: 'original', label: 'HD Original', canvas: hdCanvas },
          { name: 'green', label: 'HD Green', canvas: colorizeIris(hdCanvas, 'green') },
          { name: 'blue', label: 'HD Blue', canvas: colorizeIris(hdCanvas, 'blue') },
          { name: 'brown', label: 'HD Brown', canvas: colorizeIris(hdCanvas, 'brown') }
        ];

        item.processedEyes.push({
          id: box.id,
          index: idx + 1,
          label: box.label || `Eye ${idx + 1}`,
          box: box,
          activeVariant: 'original',
          variants: variants
        });
      } else {
        item.processedEyes.push({
          id: box.id,
          index: idx + 1,
          label: box.label || `Eye ${idx + 1}`,
          box: box,
          activeVariant: 'original',
          variants: [
            { name: 'original', label: 'Original', canvas: baseCanvas }
          ]
        });
      }
    });
  }

  function reprocessAllVariants(item) {
    processAllVariants(item);

    // Refresh canvas previews in DOM
    item.processedEyes.forEach(eye => {
      const container = document.getElementById(`previewContainer_${item.id}_${eye.id}`);
      if (container) {
        container.innerHTML = '';
        const currentVariant = eye.variants.find(v => v.name === eye.activeVariant) || eye.variants[0];
        if (currentVariant) {
          container.appendChild(currentVariant.canvas);
        }
      }
    });
  }

  // Crops bounding box and removes background to pure transparent RGBA
  function processEyeCanvas(imgEl, box) {
    const ymin = Math.round(box.ymin);
    const xmin = Math.round(box.xmin);
    const ymax = Math.round(box.ymax);
    const xmax = Math.round(box.xmax);

    const cropW = Math.max(1, xmax - xmin);
    const cropH = Math.max(1, ymax - ymin);

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // Draw cropped eye from original image
    ctx.drawImage(imgEl, xmin, ymin, cropW, cropH, 0, 0, cropW, cropH);

    // Remove near-white background to transparent (alpha = 0)
    removeCanvasBackground(canvas, ctx);
    
    // Auto-crop bounding box to non-transparent pixels
    cropCanvasToContent(canvas, ctx);

    return canvas;
  }

  // Flood-fill background removal with transparent alpha
  function removeCanvasBackground(canvas, ctx) {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const visited = new Uint8Array(w * h);
    const queue = [];
    
    const threshold = parseInt(bgToleranceInput.value) || 25;

    // Seed perimeter pixels
    for (let x = 0; x < w; x++) {
      visited[x] = 1;
      queue.push([x, 0]);
      visited[(h - 1) * w + x] = 1;
      queue.push([x, h - 1]);
    }
    for (let y = 0; y < h; y++) {
      if (!visited[y * w]) {
        visited[y * w] = 1;
        queue.push([0, y]);
      }
      if (!visited[y * w + w - 1]) {
        visited[y * w + w - 1] = 1;
        queue.push([w - 1, y]);
      }
    }

    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      const idx = cy * w + cx;

      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];

      const isNearWhite = (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold);
      
      if (isNearWhite) {
        // Set transparent (alpha = 0)
        data[pixelIdx] = 0;
        data[pixelIdx + 1] = 0;
        data[pixelIdx + 2] = 0;
        data[pixelIdx + 3] = 0;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = ny * w + nx;
            if (!visited[nIdx]) {
              visited[nIdx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  function cropCanvasToContent(canvas, ctx) {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return;

    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);

    const newW = maxX - minX + 1;
    const newH = maxY - minY + 1;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newW;
    tempCanvas.height = newH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, minX, minY, newW, newH, 0, 0, newW, newH);

    canvas.width = newW;
    canvas.height = newH;
    ctx.drawImage(tempCanvas, 0, 0);
  }

  // HD upscaling and 3x3 sharpening convolution matrix filter while preserving alpha transparency
  function upscaleAndSharpen(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return canvas;
    
    // 2x upscale
    const upCanvas = document.createElement('canvas');
    upCanvas.width = w * 2;
    upCanvas.height = h * 2;
    const upCtx = upCanvas.getContext('2d', { willReadFrequently: true });
    
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = 'high';
    upCtx.drawImage(canvas, 0, 0, w, h, 0, 0, w * 2, h * 2);
    
    const imgData = upCtx.getImageData(0, 0, w * 2, h * 2);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);
    
    const weights = [
       0, -0.4,  0,
      -0.4,  2.6, -0.4,
       0, -0.4,  0
    ];
    
    const side = 3;
    const halfSide = 1;
    const sw = w * 2;
    const sh = h * 2;
    
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dstOff = (y * sw + x) * 4;
        const alpha = copy[dstOff + 3];

        if (alpha === 0) {
          data[dstOff] = 0;
          data[dstOff + 1] = 0;
          data[dstOff + 2] = 0;
          data[dstOff + 3] = 0;
          continue;
        }

        let r = 0, g = 0, b = 0, totalWeight = 0;
        
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = Math.min(sh - 1, Math.max(0, y + cy - halfSide));
            const scx = Math.min(sw - 1, Math.max(0, x + cx - halfSide));
            const srcOff = (scy * sw + scx) * 4;
            const srcAlpha = copy[srcOff + 3];
            const wt = weights[cy * side + cx];
            
            if (srcAlpha > 0) {
              r += copy[srcOff] * wt;
              g += copy[srcOff + 1] * wt;
              b += copy[srcOff + 2] * wt;
              totalWeight += wt;
            }
          }
        }
        
        if (totalWeight > 0) {
          data[dstOff] = Math.min(255, Math.max(0, r));
          data[dstOff + 1] = Math.min(255, Math.max(0, g));
          data[dstOff + 2] = Math.min(255, Math.max(0, b));
        }
        data[dstOff + 3] = alpha;
      }
    }
    
    upCtx.putImageData(imgData, 0, 0);
    return upCanvas;
  }

  // Shifts colors of the iris to green, blue, or brown using HSL transformations while keeping transparency
  function colorizeIris(canvas, targetColor) {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return canvas;
    
    const colCanvas = document.createElement('canvas');
    colCanvas.width = w;
    colCanvas.height = h;
    
    const ctx = colCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    let targetHue = 0;
    let satMul = 1.0;
    let lightMul = 1.0;
    
    if (targetColor === 'green') {
      targetHue = 125;
      satMul = 1.2;
    } else if (targetColor === 'blue') {
      targetHue = 210;
      satMul = 1.2;
    } else if (targetColor === 'brown') {
      targetHue = 32;
      satMul = 0.8;
      lightMul = 0.7;
    }

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue; // Skip transparent background pixels
      
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      let { h, s, l } = rgbToHsl(r, g, b);
      
      // Target colored iris pixels
      if (s > 0.10 && l > 0.15 && l < 0.88) {
        h = targetHue;
        s = Math.min(1.0, s * satMul);
        l = Math.min(1.0, l * lightMul);
        
        const { r: nr, g: ng, b: nb } = hslToRgb(h, s, l);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
    return colCanvas;
  }

  // RGB / HSL Conversion Helpers
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, l };
  }

  function hslToRgb(h, s, l) {
    h /= 360;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  // Render Batch Results cards with individual eyes grid
  function renderResults() {
    resultsCard.classList.remove('hidden');
    batchResultsList.innerHTML = '';

    filesQueue.forEach(item => {
      if (item.status !== 'completed') return;

      const card = document.createElement('div');
      card.className = 'batch-result-card';
      card.id = `resultCard_${item.id}`;

      let html = `
        <div class="batch-result-title">
          <span>${item.name} (${item.processedEyes.length} ${item.processedEyes.length === 1 ? 'eye' : 'eyes'} detected)</span>
          <button class="btn btn-secondary btn-sm regen-btn" data-id="${item.id}">🔁 Edit Detection Prompt</button>
        </div>
        
        <div class="result-card-grid">
          <!-- Original Preview with Overlays -->
          <div class="original-preview">
            <div class="original-preview-header">
              <label>Original Preview</label>
              <button class="btn btn-secondary btn-sm add-box-btn" data-id="${item.id}">➕ Add Eye Box</button>
            </div>
            <div class="interactive-container" id="interactive_${item.id}">
              <img src="${item.base64}" alt="Original image" id="origImg_${item.id}">
            </div>
          </div>

          <!-- Individual Eyes Grid -->
          <div class="eyes-container">
            <div class="eyes-grid" id="eyesGrid_${item.id}">
      `;

      item.processedEyes.forEach((eye, idx) => {
        const colorClass = `color-${idx % 8}`;
        const isExtended = item.isExtended;

        html += `
          <div class="eye-card" id="eyeCard_${item.id}_${eye.id}">
            <div class="eye-card-header">
              <span class="eye-badge ${colorClass}">${eye.label}</span>
              <button class="delete-box-btn" title="Remove this eye box" data-id="${item.id}" data-eye-id="${eye.id}">✕</button>
            </div>

            <!-- Canvas Preview -->
            <div class="canvas-preview checkered-bg" id="previewContainer_${item.id}_${eye.id}"></div>

            <!-- Color Variant Tabs (if Extended Workflow is active) -->
            ${isExtended ? `
              <div class="variant-tabs">
                ${eye.variants.map(v => `
                  <button class="variant-tab-btn variant-${v.name} ${v.name === eye.activeVariant ? 'active' : ''}" 
                          data-id="${item.id}" data-eye-id="${eye.id}" data-variant="${v.name}">
                    ${v.label}
                  </button>
                `).join('')}
              </div>
            ` : ''}

            <div class="eye-actions">
              <button class="btn btn-secondary btn-sm download-eye-btn" data-id="${item.id}" data-eye-id="${eye.id}">💾 Download PNG</button>
              <button class="btn btn-secondary btn-sm edit-prompt-btn" data-id="${item.id}" data-eye-id="${eye.id}">💬 AI Edit</button>
            </div>
          </div>
        `;
      });

      html += `
            </div>
          </div>
        </div>
      `;

      card.innerHTML = html;
      batchResultsList.appendChild(card);
      
      // Inject canvases into preview containers
      item.processedEyes.forEach(eye => {
        const container = document.getElementById(`previewContainer_${item.id}_${eye.id}`);
        const currentVariant = eye.variants.find(v => v.name === eye.activeVariant) || eye.variants[0];
        if (container && currentVariant) {
          container.appendChild(currentVariant.canvas);
        }
      });

      // Bounding Box Overlay Editors
      const origImg = document.getElementById(`origImg_${item.id}`);
      if (origImg.complete) {
        setupOverlayBoxEditor(item);
      } else {
        origImg.onload = () => setupOverlayBoxEditor(item);
      }
    });

    addResultsButtonsListeners();
    resultsCard.scrollIntoView({ behavior: 'smooth' });
  }

  function rebuildOverlayBoxes(item) {
    const container = document.getElementById(`interactive_${item.id}`);
    if (!container) return;
    
    const oldOverlays = container.querySelectorAll('.eye-overlay-box');
    oldOverlays.forEach(el => el.remove());
    
    setupOverlayBoxEditor(item);
  }

  function setupOverlayBoxEditor(item) {
    const container = document.getElementById(`interactive_${item.id}`);
    const img = document.getElementById(`origImg_${item.id}`);
    if (!container || !img || !item.coords) return;

    const displayW = img.clientWidth;
    const displayH = img.clientHeight;
    const naturalW = item.originalImage.naturalWidth;
    const naturalH = item.originalImage.naturalHeight;

    if (displayW === 0 || displayH === 0) return;

    const scaleX = displayW / naturalW;
    const scaleY = displayH / naturalH;

    item.coords.forEach((boxCoords, idx) => {
      const colorClass = `color-${idx % 8}`;
      const boxDiv = document.createElement('div');
      boxDiv.className = `eye-overlay-box ${colorClass}`;
      boxDiv.setAttribute('data-label', boxCoords.label || `Eye ${idx + 1}`);

      updateBoxStyle(boxDiv, boxCoords, scaleX, scaleY);

      ['nw', 'ne', 'se', 'sw'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `box-handle handle-${pos}`;
        handle.setAttribute('data-handle', pos);
        boxDiv.appendChild(handle);
      });

      container.appendChild(boxDiv);
      setupDragResizeEvents(boxDiv, boxCoords.id, item, scaleX, scaleY);
    });
  }

  function updateBoxStyle(element, box, scaleX, scaleY) {
    const x = box.xmin * scaleX;
    const y = box.ymin * scaleY;
    const w = (box.xmax - box.xmin) * scaleX;
    const h = (box.ymax - box.ymin) * scaleY;

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.width = `${w}px`;
    element.style.height = `${h}px`;
  }

  function setupDragResizeEvents(boxDiv, eyeId, item, scaleX, scaleY) {
    let isDragging = false;
    let isResizing = false;
    let activeHandle = null;
    
    let startX = 0, startY = 0;
    let startBox = {};

    boxDiv.addEventListener('mousedown', (e) => {
      e.preventDefault();
      
      const handle = e.target.closest('.box-handle');
      if (handle) {
        isResizing = true;
        activeHandle = handle.getAttribute('data-handle');
      } else {
        isDragging = true;
      }

      startX = e.clientX;
      startY = e.clientY;

      const currentBox = item.coords.find(b => b.id === eyeId);
      if (!currentBox) return;
      startBox = { ...currentBox };

      function onMouseMove(e) {
        if (!isDragging && !isResizing) return;

        const dx = (e.clientX - startX) / scaleX;
        const dy = (e.clientY - startY) / scaleY;

        const imgW = item.originalImage.naturalWidth;
        const imgH = item.originalImage.naturalHeight;

        if (isDragging) {
          let newXmin = startBox.xmin + dx;
          let newYmin = startBox.ymin + dy;
          let w = startBox.xmax - startBox.xmin;
          let h = startBox.ymax - startBox.ymin;

          if (newXmin < 0) newXmin = 0;
          if (newYmin < 0) newYmin = 0;
          if (newXmin + w > imgW) newXmin = imgW - w;
          if (newYmin + h > imgH) newYmin = imgH - h;

          currentBox.xmin = newXmin;
          currentBox.ymin = newYmin;
          currentBox.xmax = newXmin + w;
          currentBox.ymax = newYmin + h;

        } else if (isResizing) {
          const minSize = 10;

          if (activeHandle.includes('e')) {
            currentBox.xmax = Math.min(imgW, Math.max(currentBox.xmin + minSize, startBox.xmax + dx));
          }
          if (activeHandle.includes('w')) {
            currentBox.xmin = Math.max(0, Math.min(currentBox.xmax - minSize, startBox.xmin + dx));
          }
          if (activeHandle.includes('s')) {
            currentBox.ymax = Math.min(imgH, Math.max(currentBox.ymin + minSize, startBox.ymax + dy));
          }
          if (activeHandle.includes('n')) {
            currentBox.ymin = Math.max(0, Math.min(currentBox.ymax - minSize, startBox.ymin + dy));
          }
        }

        updateBoxStyle(boxDiv, currentBox, scaleX, scaleY);
        reprocessAllVariants(item);
      }

      function onMouseUp() {
        isDragging = false;
        isResizing = false;
        activeHandle = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  function addResultsButtonsListeners() {
    // Variant tab click
    document.querySelectorAll('.variant-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const eyeId = e.target.dataset.eyeId;
        const variantName = e.target.dataset.variant;

        const item = filesQueue.find(f => f.id === id);
        if (!item) return;

        const eye = item.processedEyes.find(e => e.id === eyeId);
        if (!eye) return;

        eye.activeVariant = variantName;

        // Update active class on tab buttons for this eye
        const eyeCard = document.getElementById(`eyeCard_${item.id}_${eye.id}`);
        if (eyeCard) {
          eyeCard.querySelectorAll('.variant-tab-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
        }

        // Update canvas preview
        const container = document.getElementById(`previewContainer_${item.id}_${eye.id}`);
        if (container) {
          container.innerHTML = '';
          const currentVariant = eye.variants.find(v => v.name === variantName);
          if (currentVariant) {
            container.appendChild(currentVariant.canvas);
          }
        }
      });
    });

    // Individual eye downloads
    document.querySelectorAll('.download-eye-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const eyeId = e.target.dataset.eyeId;

        const item = filesQueue.find(f => f.id === id);
        if (!item) return;

        const eye = item.processedEyes.find(e => e.id === eyeId);
        if (!eye) return;

        const currentVariant = eye.variants.find(v => v.name === eye.activeVariant) || eye.variants[0];
        if (!currentVariant) return;

        const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        const cleanLabel = eye.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        let outName = `${baseName}_${cleanLabel}.png`;
        if (item.isExtended && currentVariant.name !== 'original') {
          outName = `${baseName}_${cleanLabel}_${currentVariant.name}.png`;
        }
        
        downloadCanvas(currentVariant.canvas, outName);
      });
    });

    // Add Eye Box Button
    document.querySelectorAll('.add-box-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const item = filesQueue.find(f => f.id === id);
        if (!item) return;

        const imgW = item.originalImage.naturalWidth;
        const imgH = item.originalImage.naturalHeight;
        const nextIdx = item.coords.length + 1;
        const newBoxSize = Math.min(imgW, imgH) * 0.25;

        const newEye = {
          id: 'eye_' + nextIdx + '_' + Math.random().toString(36).substr(2, 6),
          label: `Eye ${nextIdx}`,
          xmin: Math.max(0, Math.round(imgW / 2 - newBoxSize / 2)),
          ymin: Math.max(0, Math.round(imgH / 2 - newBoxSize / 2)),
          xmax: Math.min(imgW, Math.round(imgW / 2 + newBoxSize / 2)),
          ymax: Math.min(imgH, Math.round(imgH / 2 + newBoxSize / 2))
        };

        item.coords.push(newEye);
        item.rawEyes.push({ ...newEye });
        processAllVariants(item);
        renderResults();
      });
    });

    // Delete Eye Box Button
    document.querySelectorAll('.delete-box-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const eyeId = e.target.dataset.eyeId;

        const item = filesQueue.find(f => f.id === id);
        if (!item) return;

        item.coords = item.coords.filter(b => b.id !== eyeId);
        item.rawEyes = item.rawEyes.filter(b => b.id !== eyeId);

        processAllVariants(item);
        renderResults();
      });
    });

    // Bounding Box Regenerate Modal Opening
    document.querySelectorAll('.regen-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const item = filesQueue.find(f => f.id === id);
        if (!item) return;

        currentRegenFileId = id;
        regenPromptTextarea.value = item.promptUsed;
        regenerateModal.classList.remove('hidden');
      });
    });

    // Eye Edit Modal Opening
    document.querySelectorAll('.edit-prompt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const eyeId = e.target.dataset.eyeId;

        const item = filesQueue.find(f => f.id === id);
        if (!item) return;

        const eye = item.processedEyes.find(e => e.id === eyeId);
        if (!eye) return;

        const currentVariant = eye.variants.find(v => v.name === eye.activeVariant) || eye.variants[0];
        if (!currentVariant) return;

        currentEditCanvas = currentVariant.canvas;
        modalEyeImg.src = currentEditCanvas.toDataURL('image/png');
        editPromptTextarea.value = '';
        geminiResponseBox.classList.add('hidden');
        editModal.classList.remove('hidden');
      });
    });
  }

  function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // Zip Download Event (All transparent PNG individual eyes)
  downloadZipBtn.addEventListener('click', async () => {
    const zip = new JSZip();
    let count = 0;

    filesQueue.forEach(item => {
      if (item.status !== 'completed') return;

      const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
      
      item.processedEyes.forEach((eye, idx) => {
        const cleanLabel = eye.label.toLowerCase().replace(/[^a-z0-9]/g, '_');

        if (item.isExtended) {
          // Add each color variant as a transparent PNG file
          eye.variants.forEach(v => {
            const pngData = v.canvas.toDataURL('image/png').split(',')[1];
            const fileName = `${baseName}_${cleanLabel}_${v.name}.png`;
            zip.file(fileName, pngData, { base64: true });
            count++;
          });
        } else {
          // Standard transparent PNG file
          const currentVariant = eye.variants[0];
          const pngData = currentVariant.canvas.toDataURL('image/png').split(',')[1];
          const fileName = `${baseName}_${cleanLabel}.png`;
          zip.file(fileName, pngData, { base64: true });
          count++;
        }
      });
    });

    if (count === 0) {
      alert('No processed eye images to download.');
      return;
    }

    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = '📦 Zipping files...';

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'doll_eyes_transparent.zip';
    link.click();

    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = '📦 Download All (ZIP)';
  });

  // Modal Closures
  closeRegenModal.addEventListener('click', () => regenerateModal.classList.add('hidden'));
  cancelRegenBtn.addEventListener('click', () => regenerateModal.classList.add('hidden'));
  
  closeEditModal.addEventListener('click', () => editModal.classList.add('hidden'));
  cancelEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));

  // Submit Bounding Box Regeneration
  submitRegenBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey || !currentRegenFileId) return;

    const item = filesQueue.find(f => f.id === currentRegenFileId);
    if (!item) return;

    item.promptUsed = regenPromptTextarea.value.trim();
    regenerateModal.classList.add('hidden');

    const card = document.getElementById(`resultCard_${item.id}`);
    if (card) {
      card.style.opacity = '0.5';
    }
    
    loadingContainer.classList.remove('hidden');
    loadingText.textContent = `Regenerating ${item.name} with updated prompt...`;

    try {
      await processSingleFile(item, apiKey);
      rebuildOverlayBoxes(item);
      reprocessAllVariants(item);
    } catch (err) {
      alert(`Regeneration failed: ${err.message}`);
      console.error(err);
    } finally {
      if (card) card.style.opacity = '1';
      loadingContainer.classList.add('hidden');
      renderResults();
    }
  });

  // Submit Edit Prompt
  submitEditBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const prompt = editPromptTextarea.value.trim();
    if (!apiKey || !prompt || !currentEditCanvas) {
      alert('Please enter your instruction.');
      return;
    }

    submitEditBtn.disabled = true;
    submitEditBtn.textContent = 'Sending...';
    responseTextDiv.textContent = 'Waiting for Gemini response...';
    geminiResponseBox.classList.remove('hidden');

    try {
      const model = getActiveModel();
      const base64Data = currentEditCanvas.toDataURL('image/png').split(',')[1];
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Data
                }
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      const answer = result.candidates[0].content.parts[0].text;
      
      responseTextDiv.textContent = answer;
    } catch (err) {
      responseTextDiv.textContent = `Error: ${err.message}`;
    } finally {
      submitEditBtn.disabled = false;
      submitEditBtn.textContent = '💬 Send to Gemini';
    }
  });
});
