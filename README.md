# 👁️ Doll Eyes Splitter & Background Remover

A fast, client-side web application powered by **Google Gemini Multi-Modal AI** and **HTML5 Canvas** to detect, segment, and export transparent PNGs of individual doll, cartoon, and anime eyes from drawing sheets.

---

## ✨ Features

- **Single & Multi-Pair Eye Detection**: Intelligently detects every individual eye across single eyes, single pairs, or dense multi-pair sheets.
- **100% Transparent Backgrounds**: Flood-fill tolerance algorithm cleanly removes white/off-white paper backgrounds, outputting 32-bit RGBA transparent PNGs.
- **Interactive Bounding Box Overlays**: Drag, resize, add (`➕ Add Eye Box`), or remove (`✕`) bounding boxes on the original drawing with live re-processing.
- **Extended Workflow (HD & Color Variants)**:
  - 2x HD upscale with 3x3 sharpening convolution filter.
  - Generates Green, Blue, and Brown iris color variants.
- **Batch Processing**: Drop multiple images at once and process in a single batch queue.
- **Bulk ZIP Export**: Download all transparent segmented eyes and color variants neatly named in a `.zip` archive.
- **Interactive AI Assistant**: Ask Gemini instructions or analyze specific cropped eyes in real time.

---

## 🚀 Getting Started

### Prerequisites
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).
- Python 3.8+ (or any static HTTP server).

### Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```

2. **Launch the application**:
   ```bash
   python main.py
   # or
   npm run dev
   ```

3. Open your browser at `http://localhost:5000` (it will also attempt to open automatically).

---

## 🌐 Deploy to GitHub Pages

Because this application runs 100% client-side in the browser:
1. Go to your repository settings on GitHub (**Settings** > **Pages**).
2. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/ (root)`.
4. Click **Save** — your app will be live on `https://<your-username>.github.io/<your-repo-name>/`!

---

## 📄 License
MIT License
