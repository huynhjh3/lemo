import { invokeFunction } from "./functions.js";

export async function findProspects({ industry, location }) {
  const data = await invokeFunction("find-prospects", { industry, location });
  return data.prospects;
}
