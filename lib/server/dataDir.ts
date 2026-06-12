import path from "path";

export function getWritableDataDir() {
  return process.env.MAP_OF_US_DATA_DIR || path.join(process.cwd(), "data");
}

export function getBundledDataDir() {
  return process.env.MAP_OF_US_BUNDLED_DATA_DIR || path.join(process.cwd(), "data");
}

export function getPrivateDataFilePath(fileName: string) {
  return process.env.MAP_OF_US_DATA_DIR
    ? path.join(process.env.MAP_OF_US_DATA_DIR, fileName)
    : path.join(process.cwd(), "data", fileName);
}

export function getBundledDataFilePath(fileName: string) {
  return process.env.MAP_OF_US_BUNDLED_DATA_DIR
    ? path.join(process.env.MAP_OF_US_BUNDLED_DATA_DIR, fileName)
    : path.join(process.cwd(), "data", fileName);
}
