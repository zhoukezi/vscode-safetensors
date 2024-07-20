import * as fsPromises from "fs/promises";
import { z } from "zod";

const safetensorsTensorDescSchema = z.object({
  dtype: z.string(),
  shape: z.array(z.number()),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  data_offsets: z.array(z.number()).length(2),
});
const safetensorsMetaSchema = z.record(z.string(), z.string());
const safetensorsHeaderSchema = z
  .object({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __metadata__: safetensorsMetaSchema.optional(),
  })
  .catchall(safetensorsTensorDescSchema);

async function readExact(
  fd: fsPromises.FileHandle,
  pos: number,
  size: number
): Promise<Buffer> {
  const buffer = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await fd.read(buffer, offset, size - offset, pos);
    if (bytesRead === 0) {
      throw new Error(`Failed to read: unexpected EOF`);
    }
    offset += bytesRead;
  }
  return buffer;
}

function checkLength(jsonLength: bigint): number {
  if (jsonLength > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Failed to read: jsonLength too large`);
  }
  if (jsonLength > 2 * 1024 * 1024 /* 2MiB */) {
    throw new Error(
      `Failed to read: json header is too large, likely corrupted, stopped for safety`
    );
  }
  return Number(jsonLength);
}

function checkJsonBuffer(b: Uint8Array): string {
  let [space, lBrace, rBrace] = " {}".split("").map((c) => c.charCodeAt(0));

  let count = 0;
  for (let i = b.length - 1; i >= 0; i--) {
    if (b[i] === space) {
      count++;
    } else {
      break;
    }
  }
  b = b.subarray(0, b.length - count);

  if (b[0] !== lBrace || b[b.length - 1] !== rBrace) {
    const lossyDecoder = new TextDecoder("utf-8");
    const lossy = lossyDecoder.decode(b);
    throw new Error(
      `Failed to read: json header is not a valid JSON object: ${lossy}`
    );
  }

  const strictDecoder = new TextDecoder("utf-8", { fatal: true });
  return strictDecoder.decode(b);
}

type SafeTensorsHeaderRaw = z.infer<typeof safetensorsHeaderSchema>;
export type TensorDescription = z.infer<typeof safetensorsTensorDescSchema>;
export interface SafetensorsHeader {
  metadata?: Record<string, string>;
  tensors: Record<string, TensorDescription>;
}

function parseJson(jsonBuffer: Uint8Array): SafetensorsHeader {
  const json = JSON.parse(checkJsonBuffer(jsonBuffer)) as SafeTensorsHeaderRaw;
  const { __metadata__: metadata, ...tensors } = json;
  return { metadata, tensors };
}

export async function parseHeader(path: string): Promise<SafetensorsHeader> {
  const fd = await fsPromises.open(path, "r");

  try {
    const jsonLengthBuffer = await readExact(fd, 0, 8);
    const jsonLength = checkLength(jsonLengthBuffer.readBigUInt64LE());

    const jsonBuffer = await readExact(fd, 8, jsonLength);
    return parseJson(jsonBuffer);
  } finally {
    await fd.close();
  }
}

export function parseHeaderFromArray(data: Uint8Array): SafetensorsHeader {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const jsonLength = checkLength(view.getBigUint64(0, true));
  const jsonBuffer = data.slice(8, 8 + jsonLength);
  return parseJson(jsonBuffer);
}
