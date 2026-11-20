import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/** Ekstrak teks PDF per halaman (urutan baca) lalu gabungkan dengan pemisah halaman. */
export async function pdfToText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map((t, i) => `===== PAGE ${i + 1} =====\n${t}`).join("\n");
}
