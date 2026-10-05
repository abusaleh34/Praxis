Tesseract language data, Apache License 2.0, retrieved 2026-10-05:

- Arabic: https://github.com/tesseract-ocr/tessdata_best/blob/main/ara.traineddata (the fast model omitted a complete mixed Arabic/numeric line in our printed fixture).
- English: https://github.com/tesseract-ocr/tessdata_fast/blob/main/eng.traineddata.

The worker and WASM runtime are copied at build time from the pinned tesseract.js 6.0.1 dependency and its locked tesseract.js-core, with license files. Version 7's relaxed-SIMD runtime failed on the floating-point Arabic best model in validation; version 6 passed the same sample. Images are processed in the browser by default and are not saved by Praxis. The larger Arabic language download is cached locally after first use.
