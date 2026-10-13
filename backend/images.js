import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
const dir = path.resolve(process.env.UPLOAD_DIR || "var/uploads");
const invalid = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export async function prepareImage(image) {
  if (image == null || image === "") return null;
  if (typeof image !== "string") throw invalid("Imagem inválida.");
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) throw invalid("Use uma imagem JPG, PNG ou WebP.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    throw invalid("A imagem deve ter no máximo 5 MB.", 413);
  try {
    const instance = sharp(bytes, {
      limitInputPixels: 20000000,
      animated: false,
    });
    const meta = await instance.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format) || (meta.pages || 1) > 1)
      throw Error("Formato não suportado");
    return await instance
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    throw invalid(
      "Não foi possível ler a imagem. Escolha um JPG, PNG ou WebP válido de até 20 megapixels.",
    );
  }
}
export async function saveImage(id, bytes) {
  if (!bytes) return;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, id + ".jpg"), bytes, { flag: "wx" });
}
export async function readImage(id) {
  return fs.readFile(path.join(dir, id + ".jpg"));
}
export async function removeImage(id) {
  await fs.rm(path.join(dir, id + ".jpg"), { force: true });
}
