'use strict';

// Expose the platform's native DOMException constructor.
// Ancient platforms without native DOMException can fallback,
// but all standard modern Node.js versions (18+) include it natively.
module.exports = globalThis.DOMException || class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name || 'DOMException';
  }
};
