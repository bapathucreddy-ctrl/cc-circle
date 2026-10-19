// Check bytes, not just a user-controlled extension or Content-Type header.
export function validUploadHeader(bytes: Uint8Array, extension: string) {
  const ascii = (at: number, count: number) => String.fromCharCode(...bytes.slice(at, at + count));
  if (extension === 'jpg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === 'png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value);
  if (extension === 'webp') return bytes.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP';
  if (extension === 'mp4' || extension === 'mov') {
    if (bytes.length < 16 || ascii(4,4) !== 'ftyp') return false;
    const brands = [ascii(8,4)];
    for (let i = 16; i + 4 <= Math.min(bytes.length, 64); i += 4) brands.push(ascii(i,4));
    return brands.some(brand => extension === 'mov' ? brand === 'qt  ' : /^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|3gp[4-9])$/.test(brand));
  }
  return false;
}
