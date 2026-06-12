import { geoArea, geoMercator, geoPath, type GeoProjection } from "d3-geo";
import rawChina from "@/data/china-geo.json";
import { provinces } from "@/data/provinces";

type Position = [number, number];
type Ring = Position[];

export interface GeoFeature {
  type: "Feature";
  properties: { adcode: number; name: string };
  geometry:
    | { type: "Polygon"; coordinates: Ring[] }
    | { type: "MultiPolygon"; coordinates: Ring[][] }
    | { type: string; coordinates: unknown };
}

const adcodeToProvinceId = new Map(provinces.map((province) => [province.adcode, province.id]));

function fixWinding(feature: GeoFeature): GeoFeature {
  if (geoArea(feature as never) <= 2 * Math.PI) return feature;

  if (feature.geometry.type === "Polygon") {
    const coordinates = feature.geometry.coordinates as Ring[];

    return {
      ...feature,
      geometry: {
        type: "Polygon",
        coordinates: coordinates.map((ring) => ring.slice().reverse()),
      },
    };
  }

  if (feature.geometry.type === "MultiPolygon") {
    const coordinates = feature.geometry.coordinates as Ring[][];

    return {
      ...feature,
      geometry: {
        type: "MultiPolygon",
        coordinates: coordinates.map((polygon) => polygon.map((ring) => ring.slice().reverse())),
      },
    };
  }

  return feature;
}

export const chinaFeatures: GeoFeature[] = (rawChina.features as GeoFeature[])
  .filter(
    (feature) =>
      adcodeToProvinceId.has(feature.properties.adcode) &&
      (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon"),
  )
  .map(fixWinding);

// The South China Sea ten-dash line ships inside china-geo.json as a feature
// with adcode "100000_JD" (JD = 九段/断续线). It has no province match, so it is
// excluded from `chinaFeatures` above and rendered separately as an inset.
// It needs the same winding fix as the provinces, otherwise d3-geo treats its
// reversed rings as covering the whole sphere and the projection collapses it
// into a single point.
const rawDashLine = (rawChina.features as GeoFeature[]).find(
  (feature) => String(feature.properties.adcode) === "100000_JD",
);

export const dashLineFeature: GeoFeature | null = rawDashLine ? fixWinding(rawDashLine) : null;

export const provinceIdOf = (feature: GeoFeature): string =>
  adcodeToProvinceId.get(feature.properties.adcode) ?? "";

export function makeProjectionForFeature(
  feature: GeoFeature,
  width: number,
  height: number,
  padding = 8,
): GeoProjection {
  return geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    feature as never,
  );
}

export function makeProjection(width: number, height: number, padding = 18): GeoProjection {
  return geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    {
      type: "FeatureCollection",
      features: chinaFeatures,
    } as never,
  );
}

export const featureOfProvince = (id: string): GeoFeature | undefined =>
  chinaFeatures.find((feature) => provinceIdOf(feature) === id);

export function makeProjectionForProvince(
  id: string,
  width: number,
  height: number,
  padding = 70,
): GeoProjection {
  if (id === "hainan") {
    return geoMercator()
      .center([110.1, 19.15])
      .scale(Math.min(width, height) * 16)
      .translate([width * 0.44, height * 0.52]);
  }

  const feature = featureOfProvince(id);

  return geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    (feature ??
      {
        type: "FeatureCollection",
        features: chinaFeatures,
      }) as never,
  );
}

export function makePath(projection: GeoProjection) {
  return geoPath(projection);
}
