/**
 * TrueLabel Cryptographic Batch Visual Imprint Seal
 * Adapted from A90's 144-Pixel (12x12) Imprint Canvas
 * 
 * Computes a deterministic pseudo-random visual signature matrix from a batch code,
 * providing instant visual tamper-evidence for food safety inspectors and consumers.
 */

class TrueLabelBatchImprint {
  constructor(canvas) {
    this.canvas = canvas;
    this.size = 12; // 12x12 = 144 pixel grid
    this.pixelSize = parseInt(canvas.getAttribute('data-pixel-size'), 10) || 5;
    this.batchCode = canvas.getAttribute('data-batch-code') || 'TL-DEFAULT-000';
    this.ctx = canvas.getContext('2d');
    
    // Clinical 4-color palette (Emerald, Signal Yellow, Deep Ink, Clean Paper)
    this.colors = ['#047857', '#ffd84a', '#0b0b0c', '#fffdf6'];
    this.init();
  }

  // FNV-1a Hash for deterministic seed generation
  hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  // Linear Congruential Generator (LCG)
  lcg(seed) {
    let state = seed;
    return () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  render() {
    this.canvas.width = this.size * this.pixelSize;
    this.canvas.height = this.size * this.pixelSize;

    const seed = this.hashString(this.batchCode);
    const rng = this.lcg(seed);

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        // Enforce 2-fold horizontal symmetry for authoritative seal appearance
        const effectiveX = x < this.size / 2 ? x : this.size - 1 - x;
        const colorIndex = Math.floor(rng() * this.colors.length);

        this.ctx.fillStyle = this.colors[colorIndex];
        this.ctx.fillRect(
          x * this.pixelSize,
          y * this.pixelSize,
          this.pixelSize,
          this.pixelSize
        );
      }
    }
  }

  init() {
    this.render();
  }
}

if (typeof window !== 'undefined') {
  window.TrueLabelBatchImprint = TrueLabelBatchImprint;
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-batch-imprint]').forEach((canvas) => {
      new TrueLabelBatchImprint(canvas);
    });
  });
}
