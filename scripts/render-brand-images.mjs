import sharp from "sharp";

const app = "public/brand/adelante-app-icon.svg";
const maskable = "public/brand/adelante-app-icon-maskable.svg";
const outputs = [
  [app, "public/icon-192.png", 192],
  [app, "public/icon-512.png", 512],
  [maskable, "public/icon-192-maskable.png", 192],
  [maskable, "public/icon-512-maskable.png", 512],
  [app, "public/apple-touch-icon.png", 180],
  ["public/favicon.svg", "public/favicon-32.png", 32],
];

await Promise.all(outputs.map(async ([source, target, size]) => {
  await sharp(source).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(target);
  console.log(`${target}: ${size}×${size}`);
}));
await sharp("public/brand/adelante-share.svg")
  .resize(1200, 630)
  .flatten({ background: "#FBF8F3" })
  .jpeg({ quality: 90 })
  .toFile("public/website-share.jpg");
console.log("public/website-share.jpg: 1200×630, JPEG quality 90");