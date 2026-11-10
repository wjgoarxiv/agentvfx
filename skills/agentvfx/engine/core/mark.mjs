// agentvfx (Apache-2.0, see LICENSE). Local replacement for the plugin's lib/mark.mjs: the generator
// tag and the credit line that ffmpeg writes into every MP4, plus an optional comment (the stage-mode flashing notice).
// The credit also goes to CREDIT.txt next to the film, so it is easy to paste when the film is published.
export const GENERATOR = "agentvfx";
export const CREDIT_TEXT = "Made with agentvfx by Woojin Go - https://github.com/wjgoarxiv/agentvfx";
export const CREDIT_SHORT = "VFX: agentvfx (github.com/wjgoarxiv/agentvfx)";

export function creditText() {
  return `${CREDIT_TEXT}

Publishing this film? A credit is appreciated, not required. The film carries a small on-screen credit; you can
keep it in the frame, or switch it off ("credit": { "overlay": false }) and put the line above in the description,
caption or credits. Where space is short: ${CREDIT_SHORT}
Licence: Apache-2.0. See LICENSE and NOTICE in https://github.com/wjgoarxiv/agentvfx.
`;
}

export function ffmpegMetadataArgs({ comment = null } = {}) {
  const args = ["-metadata", `encoder_tool=${GENERATOR}`, "-metadata", `description=${CREDIT_TEXT}`];
  if (comment) args.push("-metadata", `comment=${comment}`);
  return args;
}

// The on-screen credit burned into a corner of every render unless the score sets "credit": { "overlay": false }.
export const CREDIT_OVERLAY = "made with agentvfx";
