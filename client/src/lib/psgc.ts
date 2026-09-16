export type PsgcPlace = { code: string; name: string; regionCode?: string; provinceCode?: string; isCity?: boolean };
const PSGC_API = "https://psgc.gitlab.io/api";

async function getPlaces(path: string): Promise<PsgcPlace[]> {
  const response = await fetch(`${PSGC_API}${path}`);
  if (!response.ok) throw new Error("Unable to load Philippine geographic data.");
  return response.json() as Promise<PsgcPlace[]>;
}

export const fetchRegions = () => getPlaces("/regions.json");
export const fetchProvinces = (regionCode: string) => getPlaces(`/regions/${regionCode}/provinces.json`);
export const fetchCitiesMunicipalities = (provinceCode: string) => getPlaces(`/provinces/${provinceCode}/cities-municipalities.json`);
export const fetchBarangays = (placeCode: string, isCity: boolean) => getPlaces(`/${isCity ? "cities" : "municipalities"}/${placeCode}/barangays.json`);

export function calculateAge(birthDate: string, today = new Date()): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth > today) return null;
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const month = today.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 0 ? age : null;
}
