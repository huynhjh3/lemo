import { invokeFunction } from "./functions.js";

export async function findProspects({ industry, location, installedProfile }) {
  const data = await invokeFunction("find-prospects", { industry, location, installedProfile });
  return data.prospects;
}
