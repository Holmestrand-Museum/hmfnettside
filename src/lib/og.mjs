// Delt logikk for Facebook-trygge delingsbilder (og:image).
//
// Facebook/OG rendrer IKKE WebP i delingsforhåndsvisninger – da faller bildet
// bort, og bare tittel + lenke vises. Derfor må ALLE og:image være JPG (eller PNG).
// Heroer/bilder som er WebP konverteres til JPG i public/images/og/ av
// scripts/build-og-images.mjs, og Layout peker og:image dit via toOgJpeg().

// Sant hvis stien allerede er et format Facebook takler (JPG/PNG) – da trengs
// ingen konvertering.
export function isFbSafe(p) {
  return /\.(jpe?g|png)$/i.test(p);
}

// Gjør en servert /images/-sti om til en deterministisk og:image-sti under
// /images/og/ med .jpg-endelse. Samme funksjon brukes både når filene GENERERES
// (build-scriptet) og når de REFERERES (Layout), så navnene alltid stemmer.
//   /images/tordenskiold-web/lovendals-galley.webp
//     -> /images/og/tordenskiold-web-lovendals-galley.jpg
export function toOgJpeg(publicPath) {
  const rel = publicPath.replace(/^\/?images\//, '').replace(/\.[^.\/]+$/, '');
  const safe = rel.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `/images/og/${safe}.jpg`;
}
