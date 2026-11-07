// agentvfx (agentvfx licence, see LICENSE). Local replacement for the plugin's lib/mark.mjs: the generator
// tag and the credit line that ffmpeg writes into every MP4, plus an optional comment (the stage-mode flashing notice).
// Attribution is a licence condition for published output, so the credit also goes to CREDIT.txt next to the film.
export const GENERATOR = "agentvfx";
export const CREDIT_TEXT = "Made with agentvfx by Woojin Go - https://github.com/wjgoarxiv/agentvfx";
export const CREDIT_SHORT = "VFX: agentvfx (github.com/wjgoarxiv/agentvfx)";

export function creditText() {
  return `${CREDIT_TEXT}

Publishing this film? The agentvfx licence requires a credit. The film carries a small on-screen credit; keep it
in the frame. If you switched it off ("credit": { "overlay": false }), put the line above where viewers can find
it: the description, caption or credits. Where space is short: ${CREDIT_SHORT}
When you hand the film to someone who will publish it, pass the credit on with it.
Licence: the agentvfx licence (Additional Terms plus the PolyForm Noncommercial License 1.0.0). Individuals may use
their own output commercially; companies, client work, paid services and AI training are not covered.
See LICENSE in https://github.com/wjgoarxiv/agentvfx.
`;
}

export function ffmpegMetadataArgs({ comment = null } = {}) {
  const args = ["-metadata", `encoder_tool=${GENERATOR}`, "-metadata", `description=${CREDIT_TEXT}`];
  if (comment) args.push("-metadata", `comment=${comment}`);
  return args;
}

// The on-screen credit burned into a corner of every render unless the score sets "credit": { "overlay": false }.
export const CREDIT_OVERLAY = "made with agentvfx";
