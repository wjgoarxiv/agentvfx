// Builds ../main.frag from the numbered GLSL parts in this folder, generating the 3 x 5 font table.
// Run: node templates/brutal/collage/_src/build.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ART = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001001001001", 8: "111101111101111", 9: "111101111001111",
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
  F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
  K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
  P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
  Z: "111001010100111", ".": "000000000000010", "-": "000000111000000", "+": "000010111010000", "/": "001001010100100",
  ":": "000010000010000", "%": "101001010100101",
};
const order = [..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.-+/:%"];
const font = `const int FONT[${order.length}] = int[${order.length}](${order.map((c) => `0x${parseInt(ART[c], 2).toString(16).toUpperCase()}`).join(", ")});`;
const parts = readdirSync(here).filter((f) => /^\d+-.*\.glsl$/u.test(f)).sort();
const body = parts.map((f) => readFileSync(path.join(here, f), "utf8").replace("//@FONT@", font)).join("\n");
writeFileSync(path.join(here, "..", "main.frag"), body);
process.stdout.write(`main.frag from ${parts.join(", ")}\n`);
