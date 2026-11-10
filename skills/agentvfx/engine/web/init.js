// agentvfx (Apache-2.0, see LICENSE). Injected before any page script: the page has no wall clock and no
// unseeded randomness. Math.random is a seeded mulberry32; Date and performance.now are frozen at 0
// (time comes only from the frame index the host passes to window.__litStep).
(() => {
  let s = __LIT_SEED__ >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Object.defineProperty(Math, "random", { value: rand, writable: false, configurable: false });
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [0])); }
    static now() { return 0; }
  }
  window.Date = FrozenDate;
  if (window.performance) Object.defineProperty(window.performance, "now", { value: () => 0, configurable: false });
  window.requestAnimationFrame = () => { throw new Error("requestAnimationFrame is not available on the render page"); };
  window.__LIT_SEED = __LIT_SEED__ >>> 0;
})();
