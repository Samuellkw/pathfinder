import assetsData from "@/data/assets.json";
import edgesData from "@/data/edges.json";
import nodesData from "@/data/nodes.json";
import placesData from "@/data/places.json";
import routeMediaBindingsData from "@/data/route_media_bindings.json";
import verticalConnectorsData from "@/data/vertical_connectors.json";
import {
  AssetRecord,
  ConnectorGroup,
  Edge,
  NodeRecord,
  Place,
  RouteMediaBinding,
  buildConnectorPathMap,
  buildMapById,
  buildRouteSteps,
  findShortestRoute,
  getStorePlaces
} from "@/lib/navigation";

export const places = placesData as Place[];
export const edges = (edgesData as { edges: Edge[] }).edges;
export const nodes = (nodesData as { nodes: NodeRecord[] }).nodes;
export const assets = (assetsData as { assets: AssetRecord[] }).assets;
export const routeMediaBindings = (
  routeMediaBindingsData as { bindings: RouteMediaBinding[] }
).bindings;
export const connectorGroups = (
  verticalConnectorsData as { connector_groups: ConnectorGroup[] }
).connector_groups;
export const stores = getStorePlaces(places);

export const routeContext = {
  placeById: buildMapById(places),
  nodeById: buildMapById(nodes),
  assetById: buildMapById(assets),
  connectorPathById: buildConnectorPathMap(connectorGroups),
  routeMediaBindings
};

export type StoreMatch = {
  store: Place;
  score: number;
};

const STORE_ALIASES: Record<string, string> = {
  "body shop": "the body shop",
  bodyshop: "the body shop",
  "ray ban": "ray-ban",
  rayban: "ray-ban",
  "charles and keith": "charles & keith",
  "charles keith": "charles & keith",
  "c and k": "charles & keith",
  "love n bravery": "love & bravery",
  "love and bravery": "love & bravery",
  "tbb": "tiong bahru bakery",
  "macs": "mcdonalds",
  "mcdonald's": "mcdonalds",
  "taiwan noodles": "taiwan noodle and dumpling",
  "din tai fung": "din tai fung"
};

export function normaliseStoreText(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return STORE_ALIASES[normalized] ?? normalized;
}

function tokenOverlapScore(query: string, name: string) {
  const queryTokens = new Set(query.split(" ").filter(Boolean));
  const nameTokens = new Set(name.split(" ").filter(Boolean));

  if (queryTokens.size === 0 || nameTokens.size === 0) {
    return 0;
  }

  const overlap = [...queryTokens].filter((token) => nameTokens.has(token)).length;
  return overlap / Math.max(queryTokens.size, nameTokens.size);
}

export function findStoreMatches(query: string, limit = 3): StoreMatch[] {
  const normalizedQuery = normaliseStoreText(query);

  if (!normalizedQuery) {
    return [];
  }

  return stores
    .map((store) => {
      const normalizedName = normaliseStoreText(store.name);
      let score = 0;

      if (normalizedName === normalizedQuery) {
        score = 100;
      } else if (
        normalizedName.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedName)
      ) {
        score = 84;
      } else {
        score = Math.round(tokenOverlapScore(normalizedQuery, normalizedName) * 72);
      }

      return { store, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function resolveStore(query: string) {
  const matches = findStoreMatches(query);
  const best = matches[0];
  const second = matches[1];

  if (!best || best.score < 58) {
    return { store: undefined, matches };
  }

  if (second && best.score - second.score < 7 && best.score < 100) {
    return { store: undefined, matches };
  }

  return { store: best.store, matches };
}

export function getStoreById(id: string | undefined) {
  return id ? routeContext.placeById.get(id) : undefined;
}

export function buildRouteForStores(startId: string, destinationId: string) {
  const route = findShortestRoute(edges, startId, destinationId);

  if (!route) {
    return null;
  }

  return {
    route,
    steps: buildRouteSteps(route, routeContext)
  };
}

export function storeCatalogueForPrompt() {
  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    floor: store.floor_display ?? store.floor_id,
    unit: store.unit ?? ""
  }));
}
