export type StorageDriver = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function createChunkedStorage(driver: StorageDriver, chunkSize = 1800) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("chunkSize must be a positive integer");
  }
  const manifestKey = (key: string) => `${key}.manifest`;
  const partKey = (key: string, index: number) => `${key}.part.${index}`;
  const readCount = async (key: string): Promise<number> => {
    const raw = await driver.getItem(manifestKey(key));
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      return Number.isInteger(parsed.parts) && parsed.parts > 0 ? parsed.parts : 0;
    } catch {
      return 0;
    }
  };
  return {
    async getItem(key: string) {
      const count = await readCount(key);
      if (!count) return null;
      const parts = await Promise.all(
        Array.from({ length: count }, (_, index) => driver.getItem(partKey(key, index))),
      );
      return parts.some((part) => part === null) ? null : parts.join("");
    },
    async setItem(key: string, value: string) {
      const oldCount = await readCount(key);
      const parts = value.match(new RegExp(`.{1,${chunkSize}}`, "gs")) ?? [""];
      await Promise.all(parts.map((part, index) => driver.setItem(partKey(key, index), part)));
      await driver.setItem(manifestKey(key), JSON.stringify({ parts: parts.length }));
      await Promise.all(
        Array.from({ length: Math.max(0, oldCount - parts.length) }, (_, index) =>
          driver.removeItem(partKey(key, parts.length + index)),
        ),
      );
    },
    async removeItem(key: string) {
      const count = await readCount(key);
      await Promise.all(
        Array.from({ length: count }, (_, index) => driver.removeItem(partKey(key, index))),
      );
      await driver.removeItem(manifestKey(key));
    },
  };
}
