import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceImage = './src/assets/images/app_logo_1781251409675.jpg';
const publicDir = './public';

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const sizes = [
  { width: 16, height: 16, name: 'favicon-16x16.png' },
  { width: 32, height: 32, name: 'favicon-32x32.png' },
  { width: 48, height: 48, name: 'favicon-48x48.png' },
  { width: 72, height: 72, name: 'icon-72x72.png' },
  { width: 96, height: 96, name: 'icon-96x96.png' },
  { width: 128, height: 128, name: 'icon-128x128.png' },
  { width: 144, height: 144, name: 'icon-144x144.png' },
  { width: 152, height: 152, name: 'icon-152x152.png' },
  { width: 180, height: 180, name: 'apple-touch-icon.png' },
  { width: 192, height: 192, name: 'icon-192x192.png' },
  { width: 384, height: 384, name: 'icon-384x384.png' },
  { width: 512, height: 512, name: 'icon-512x512.png' },
];

async function generatePngs() {
  console.log(`Generating icons from: ${sourceImage}...`);
  for (const size of sizes) {
    const destPath = path.join(publicDir, size.name);
    await sharp(sourceImage)
      .resize(size.width, size.height)
      .toFormat('png')
      .toFile(destPath);
    console.log(`Created: ${size.name}`);
  }

  // Also build favicon.ico by copying/converting the 32x32 or 48x48 one
  const faviconIco = path.join(publicDir, 'favicon.ico');
  await sharp(sourceImage)
    .resize(32, 32)
    .toFormat('png')
    .toFile(faviconIco);
  console.log('Created: favicon.ico');
}

// Generate a clean custom SVG vector version of the car logo
function generateSvg() {
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="112" fill="#111827"/>
  <!-- Sleek premium line-art car logo in the center -->
  <g fill="none" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" transform="translate(56, 120)">
    <!-- Cabin Roof -->
    <path d="M120,160 L160,70 L240,70 L280,160" />
    <!-- Rear body & tail -->
    <path d="M40,160 L120,160" />
    <!-- Front bonnet -->
    <path d="M280,160 L360,160 L350,210 L50,210 L40,160 Z" />
    <!-- Front wheel arch -->
    <circle cx="110" cy="220" r="45" fill="#111827" stroke="#FFFFFF" stroke-width="20" />
    <!-- Rear wheel arch -->
    <circle cx="290" cy="220" r="45" fill="#111827" stroke="#FFFFFF" stroke-width="20" />
    <!-- Wheel Details Inner Spokes -->
    <circle cx="110" cy="220" r="15" fill="#FFFFFF" />
    <circle cx="290" cy="220" r="15" fill="#FFFFFF" />
    <!-- Lights -->
    <path d="M350,175 L360,175" stroke="#FBBF24" stroke-width="16" />
    <path d="M50,175 L40,175" stroke="#EF4444" stroke-width="16" />
  </g>
</svg>`;

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
  console.log('Created: icon.svg');
}

async function main() {
  try {
    await generatePngs();
    generateSvg();
    console.log('All icons generated successfully!');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

main();
