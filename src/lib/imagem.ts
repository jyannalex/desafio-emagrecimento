/** Lado maior da foto depois de reduzida: boa no celular e com ~150–250 KB em JPEG. */
export const FOTO_LADO_MAX = 1280;
const QUALIDADE = 0.72;

export function fitSize(w: number, h: number, max = FOTO_LADO_MAX): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

async function decodificar(file: Blob): Promise<{ img: CanvasImageSource; w: number; h: number; fechar: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { img: bmp, w: bmp.width, h: bmp.height, fechar: () => bmp.close() };
    } catch {
      /* cai para <img> abaixo */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { img, w: img.naturalWidth, h: img.naturalHeight, fechar: () => URL.revokeObjectURL(url) };
}

/** Reduz a foto no próprio aparelho antes de enviar (JPEG, lado maior 1280). */
export async function compressImage(file: Blob): Promise<Blob> {
  const { img, w, h, fechar } = await decodificar(file);
  try {
    const t = fitSize(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = t.w;
    canvas.height = t.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponível');
    ctx.drawImage(img, 0, 0, t.w, t.h);
    return await new Promise<Blob>((ok, falha) =>
      canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível preparar a foto'))), 'image/jpeg', QUALIDADE),
    );
  } finally {
    fechar();
  }
}
