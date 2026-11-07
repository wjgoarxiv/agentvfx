# pixel-sort notes

The pass files (`pass0.frag` .. `pass8.frag`, `main.frag`) are generated: edit `build-passes.mjs`, then run
`node build-passes.mjs` in this folder. The engine wants one file per pass, so the shared GLSL is pasted into each.

- Idea credit: pixel sorting as in ASDFPixelSort by Kim Asendorf. No code from it is used.
- Approach: a GPU cannot run a per-row sort loop, so spans are found by run-length doubling (pass1..pass8, each
  pass doubles the known run, spans are at most 256 cells) and the last pass ranks up to 32 strided samples of
  its own span. A span of 32 cells or fewer is sorted exactly; longer spans get a quantile approximation
  (monotonic in the sort key, `softness` interpolates between ranks).
- Cells: `cellSize` groups pixels into square cells, which is what gives the chunky look at larger values.
- Span cuts sit at multiples of 256 cells, shifted per row by `cutJitter` so the cuts never line up in a column.
- Reading order: horizontal sorts left to right, vertical sorts top to bottom; `descend` flips it.
