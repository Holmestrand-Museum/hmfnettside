// Genererer Facebook-trygge JPG-delingsbilder (og:image) for hver side som har
// et eget delingsbilde. Facebook rendrer ikke WebP, så alle WebP-heroer/bilder
// som brukes som og:image får en JPG-variant i public/images/og/.
//
// Kjøres i predev/prebuild ETTER sync-images.mjs (som fyller public/images/).
// public/images/ er gitignored og bygges på nytt hver gang, så disse JPG-ene
// er rene byggeartefakter – de committes ikke.
//
// Kilder som dekkes:
//   - content/posts/**/*.md   (frontmatter hero ?? image, ellers første brødtekstbilde)
//   - src/data/quiz/*.json     (quiz.image)
import { readdirSync, statSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { toOgJpeg, isFbSafe } from '../src/lib/og.mjs';

// Se optimize-images.mjs: skru av libvips-cache for å unngå fillås på Windows.
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_IMAGES = join(root, 'public', 'images');
const OG_DIR = join(PUBLIC_IMAGES, 'og');
const POSTS = join(root, 'content', 'posts');
const QUIZ = join(root, 'src', 'data', 'quiz');

const EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const OG_WIDTH = 1200; // god størrelse for delingsbilder
const Q_JPG = 82;

// Resolver et bildefelt (som resolveImage i src/lib/posts.ts) til en servert
// /images/-sti. «bilde-NNN» uten endelse slås opp mot faktiske filer i public/.
function resolvePublic(name) {
  if (!name) return null;
  if (/\.[a-z0-9]+$/i.test(name)) return `/images/${name}`;
  for (const ext of EXTS) {
    if (existsSync(join(PUBLIC_IMAGES, `${name}.${ext}`))) return `/images/${name}.${ext}`;
  }
  return null;
}

// Finn og:image-kilden for en post: frontmatter hero ?? image, ellers første
// markdown-bilde i brødteksten (samme rekkefølge som historier/[slug].astro).
function ogSourceFromPost(md) {
  const fm = md.match(/^---\n([\s\S]*?)\n---/);
  let hero, image;
  if (fm) {
    const h = fm[1].match(/^hero:\s*(.+)$/m);
    if (h) hero = h[1].trim().replace(/^["']|["']$/g, '');
    const i = fm[1].match(/^image:\s*(.+)$/m);
    if (i) image = i[1].trim().replace(/^["']|["']$/g, '');
  }
  const field = hero || image;
  if (field) return resolvePublic(field);
  const body = fm ? md.slice(fm[0].length) : md;
  const m = body.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return m ? m[1] : null;
}

function walkMd(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(full));
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// --- Samle unike kilder som trenger konvertering (dvs. ikke allerede JPG/PNG) ---
const sources = new Set();
for (const f of walkMd(POSTS)) {
  const src = ogSourceFromPost(readFileSync(f, 'utf8'));
  if (src && !isFbSafe(src)) sources.add(src);
}
if (existsSync(QUIZ)) {
  for (const f of readdirSync(QUIZ)) {
    if (!f.endsWith('.json')) continue;
    let data;
    try { data = JSON.parse(readFileSync(join(QUIZ, f), 'utf8')); } catch { continue; }
    const src = resolvePublic(data.image);
    if (src && !isFbSafe(src)) sources.add(src);
  }
}

// --- Generer JPG-variantene ---
mkdirSync(OG_DIR, { recursive: true });
let made = 0, skipped = 0, missing = 0, failed = 0;
for (const src of sources) {
  const rel = src.replace(/^\/images\//, '');
  const input = join(PUBLIC_IMAGES, ...rel.split('/'));
  if (!existsSync(input)) { missing++; console.warn(`  ! mangler kilde: ${src}`); continue; }
  const outRel = toOgJpeg(src).replace(/^\//, '');
  const outFull = join(root, 'public', ...outRel.split('/'));
  // Hopp over hvis alt er generert og nyere enn kilden.
  if (existsSync(outFull) && statSync(outFull).mtimeMs >= statSync(input).mtimeMs) { skipped++; continue; }
  try {
    await sharp(input)
      .rotate()
      .resize({ width: OG_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: Q_JPG, mozjpeg: true })
      .toFile(outFull);
    made++;
  } catch (e) {
    failed++;
    console.error(`  ! feilet: ${src} – ${e.message}`);
  }
}

console.log(`[og-bilder] laget ${made}, hoppet ${skipped}, manglende kilde ${missing}${failed ? `, feilet ${failed}` : ''} (av ${sources.size} kilder)`);
