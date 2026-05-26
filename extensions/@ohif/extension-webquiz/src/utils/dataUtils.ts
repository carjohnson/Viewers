//=========================================================
export const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((val, i) => val === b[i]);


// =====================================
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

//=========================================================
