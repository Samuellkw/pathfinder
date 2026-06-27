export type FloorId = "b1" | "l1" | "l2" | string;

export type Place = {
  id: string;
  type: string;
  name: string;
  floor_id: FloorId;
  floor_display?: string;
  unit?: string | null;
  clockwise_index?: number;
  photo_assets?: {
    all_capture_asset_ids?: string[];
    usable_reference_asset_ids?: string[];
    storefront_asset_id?: string | null;
    outward_view_asset_id?: string | null;
  };
};

export type NodeRecord = {
  id: string;
  type: string;
  name: string;
  floor_id: FloorId;
  unit?: string | null;
  photo_assets?: string[];
  photo_asset_id?: string;
};

export type Edge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  physical_mode?: "walk" | "walk_to_connector" | "escalator" | string;
  routing_weight?: number;
  floor_id?: FloorId | null;
  direction?: string;
  instruction?: string;
  connector_group_id?: string;
  connector_path_id?: string;
  from_floor_id?: FloorId;
  to_floor_id?: FloorId;
};

export type AssetRecord = {
  id: string;
  kind: string;
  web_path?: string | null;
  floor_id?: FloorId;
  direction?: string;
  sequence_position?: number;
  step_type?: string;
  node_id?: string;
  connector_group_id?: string;
  status?: string;
};

export type RouteSequence = {
  floor_id: FloorId;
  clockwise_asset_ids?: string[];
  counterclockwise_asset_ids?: string[];
};

export type ConnectorPath = {
  id: string;
  direction: string;
  from_floor_id: FloorId;
  to_floor_id: FloorId;
  from_landmark?: string;
  to_landmark?: string;
  instruction?: string;
};

export type ConnectorGroup = {
  id: string;
  label: string;
  reference_photo_asset_id?: string;
  paths: ConnectorPath[];
};

export type ConnectorPathView = ConnectorPath & {
  groupId: string;
  groupLabel: string;
  referencePhotoAssetId?: string;
};

export type RouteResult = {
  startId: string;
  destinationId: string;
  edges: Edge[];
  nodeIds: string[];
  totalWeight: number;
};

export type ImageCard = {
  src: string;
  title: string;
  caption?: string;
};

export type RouteStep = {
  id: string;
  kind: "start" | "walk" | "access" | "connector" | "arrival" | "same";
  title: string;
  body: string;
  meta?: string;
  fromLandmark?: string;
  toLandmark?: string;
  images: ImageCard[];
};

export type RouteBuildContext = {
  placeById: Map<string, Place>;
  nodeById: Map<string, NodeRecord>;
  assetById: Map<string, AssetRecord>;
  connectorPathById: Map<string, ConnectorPathView>;
  sequences: RouteSequence[];
};

const FLOOR_ORDER = new Map([
  ["b1", 0],
  ["l1", 1],
  ["l2", 2]
]);

const FLOOR_LABELS: Record<string, string> = {
  b1: "Basement 1",
  l1: "Level 1",
  l2: "Level 2"
};

export function getStorePlaces(places: Place[]) {
  return places
    .filter((place) => place.type === "store")
    .slice()
    .sort((a, b) => {
      const floorDiff =
        (FLOOR_ORDER.get(a.floor_id) ?? 99) - (FLOOR_ORDER.get(b.floor_id) ?? 99);
      if (floorDiff !== 0) {
        return floorDiff;
      }

      return (a.clockwise_index ?? 999) - (b.clockwise_index ?? 999);
    });
}

export function buildMapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item] as const));
}

export function buildConnectorPathMap(groups: ConnectorGroup[]) {
  const map = new Map<string, ConnectorPathView>();

  for (const group of groups) {
    for (const path of group.paths) {
      map.set(path.id, {
        ...path,
        groupId: group.id,
        groupLabel: group.label,
        referencePhotoAssetId: group.reference_photo_asset_id
      });
    }
  }

  return map;
}

export function findShortestRoute(
  edges: Edge[],
  startId: string,
  destinationId: string
): RouteResult | null {
  if (startId === destinationId) {
    return {
      startId,
      destinationId,
      edges: [],
      nodeIds: [startId],
      totalWeight: 0
    };
  }

  const adjacency = new Map<string, Edge[]>();
  const nodeIds = new Set<string>([startId, destinationId]);

  for (const edge of edges) {
    nodeIds.add(edge.from_node_id);
    nodeIds.add(edge.to_node_id);

    const outgoing = adjacency.get(edge.from_node_id) ?? [];
    outgoing.push(edge);
    adjacency.set(edge.from_node_id, outgoing);
  }

  const unvisited = new Set(nodeIds);
  const distance = new Map<string, number>();
  const previousEdge = new Map<string, Edge>();

  for (const nodeId of nodeIds) {
    distance.set(nodeId, Number.POSITIVE_INFINITY);
  }
  distance.set(startId, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const nodeId of unvisited) {
      const candidateDistance = distance.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (candidateDistance < currentDistance) {
        current = nodeId;
        currentDistance = candidateDistance;
      }
    }

    if (current === null || currentDistance === Number.POSITIVE_INFINITY) {
      break;
    }

    unvisited.delete(current);

    if (current === destinationId) {
      break;
    }

    for (const edge of adjacency.get(current) ?? []) {
      const nextDistance = currentDistance + (edge.routing_weight ?? 1);
      if (nextDistance < (distance.get(edge.to_node_id) ?? Number.POSITIVE_INFINITY)) {
        distance.set(edge.to_node_id, nextDistance);
        previousEdge.set(edge.to_node_id, edge);
      }
    }
  }

  if (!previousEdge.has(destinationId)) {
    return null;
  }

  const pathEdges: Edge[] = [];
  let cursor = destinationId;

  while (cursor !== startId) {
    const edge = previousEdge.get(cursor);
    if (!edge) {
      return null;
    }

    pathEdges.unshift(edge);
    cursor = edge.from_node_id;
  }

  return {
    startId,
    destinationId,
    edges: pathEdges,
    nodeIds: [startId, ...pathEdges.map((edge) => edge.to_node_id)],
    totalWeight: distance.get(destinationId) ?? 0
  };
}

export function buildRouteSteps(route: RouteResult, context: RouteBuildContext) {
  const start = getDisplayNode(route.startId, context);
  const destination = getDisplayNode(route.destinationId, context);

  if (route.edges.length === 0) {
    return [
      {
        id: "same-location",
        kind: "same",
        title: "You are already there",
        body: `${start.name} is the selected destination.`,
        meta: floorLabel(start.floor_id),
        images: getNodeImages(route.startId, context, 2)
      } satisfies RouteStep
    ];
  }

  const steps: RouteStep[] = [
    {
      id: "start",
      kind: "start",
      title: `Start at ${start.name}`,
      body: locationLine(start),
      meta: floorLabel(start.floor_id),
      images: getNodeImages(route.startId, context, 1)
    }
  ];

  for (let index = 0; index < route.edges.length; index += 1) {
    const edge = route.edges[index];

    if (edge.physical_mode === "walk") {
      const group = [edge];
      let nextIndex = index + 1;

      while (
        nextIndex < route.edges.length &&
        route.edges[nextIndex].physical_mode === "walk" &&
        route.edges[nextIndex].floor_id === edge.floor_id &&
        route.edges[nextIndex].direction === edge.direction
      ) {
        group.push(route.edges[nextIndex]);
        nextIndex += 1;
      }

      steps.push(buildWalkStep(group, context));
      index = nextIndex - 1;
      continue;
    }

    if (edge.physical_mode === "escalator") {
      steps.push(buildConnectorStep(edge, context));
      continue;
    }

    steps.push(buildAccessStep(edge, context));
  }

  steps.push({
    id: "arrival",
    kind: "arrival",
    title: `Arrive at ${destination.name}`,
    body: locationLine(destination),
    meta: floorLabel(destination.floor_id),
    images: getNodeImages(route.destinationId, context, 2)
  });

  return steps;
}

function buildWalkStep(edges: Edge[], context: RouteBuildContext): RouteStep {
  const firstEdge = edges[0];
  const lastEdge = edges[edges.length - 1];
  const from = getDisplayNode(firstEdge.from_node_id, context);
  const to = getDisplayNode(lastEdge.to_node_id, context);
  const direction = directionLabel(firstEdge.direction);
  const passBy = edges
    .slice(0, -1)
    .map((edge) => getDisplayNode(edge.to_node_id, context))
    .filter((node) => node.type === "store")
    .map((node) => node.name);

  const passingText =
    passBy.length > 0 ? ` You will pass ${formatList(passBy)}.` : "";

  return {
    id: edges.map((edge) => edge.id).join("__"),
    kind: "walk",
    title: `Walk ${direction}`,
    body: `From ${from.name}, follow the ${floorLabel(firstEdge.floor_id ?? from.floor_id)} loop to ${to.name}.${passingText}`,
    meta: `${floorLabel(firstEdge.floor_id ?? from.floor_id)} - ${edges.length} segment${
      edges.length === 1 ? "" : "s"
    }`,
    images: getRouteSequenceImages(
      firstEdge.floor_id ?? from.floor_id,
      firstEdge.direction,
      context
    )
  };
}

function buildAccessStep(edge: Edge, context: RouteBuildContext): RouteStep {
  const from = getDisplayNode(edge.from_node_id, context);
  const to = getDisplayNode(edge.to_node_id, context);
  const isExit = edge.instruction?.toLowerCase().startsWith("exit");

  return {
    id: edge.id,
    kind: "access",
    title: isExit ? "Exit to the corridor" : "Walk to the escalator",
    body: edge.instruction ?? `Move from ${from.name} to ${to.name}.`,
    meta: floorLabel(edge.floor_id ?? from.floor_id ?? to.floor_id),
    images: getNodeImages(edge.to_node_id, context, 1)
  };
}

function buildConnectorStep(edge: Edge, context: RouteBuildContext): RouteStep {
  const connector = edge.connector_path_id
    ? context.connectorPathById.get(edge.connector_path_id)
    : undefined;
  const direction = connector?.direction ?? edge.direction ?? "escalator";
  const fromFloor = connector?.from_floor_id ?? edge.from_floor_id;
  const toFloor = connector?.to_floor_id ?? edge.to_floor_id;
  const referenceAsset = connector?.referencePhotoAssetId
    ? context.assetById.get(connector.referencePhotoAssetId)
    : undefined;
  const images = referenceAsset?.web_path
    ? [
        {
          src: referenceAsset.web_path,
          title: connector?.groupLabel ?? "Escalator reference",
          caption: "Connector reference"
        }
      ]
    : [];

  return {
    id: edge.id,
    kind: "connector",
    title: `${connector?.groupLabel ?? "Escalator"} ${direction}`,
    body:
      connector?.instruction ??
      edge.instruction ??
      `Take the escalator from ${floorLabel(fromFloor)} to ${floorLabel(toFloor)}.`,
    meta: `${floorLabel(fromFloor)} to ${floorLabel(toFloor)}`,
    fromLandmark: connector?.from_landmark,
    toLandmark: connector?.to_landmark,
    images
  };
}

function getRouteSequenceImages(
  floorId: FloorId | null | undefined,
  direction: string | undefined,
  context: RouteBuildContext
) {
  if (!floorId || (direction !== "clockwise" && direction !== "counterclockwise")) {
    return [];
  }

  const sequence = context.sequences.find((item) => item.floor_id === floorId);
  const assetIds =
    direction === "clockwise"
      ? sequence?.clockwise_asset_ids
      : sequence?.counterclockwise_asset_ids;

  return (assetIds ?? [])
    .slice(0, 2)
    .map((assetId) => context.assetById.get(assetId))
    .filter((asset): asset is AssetRecord => Boolean(asset?.web_path))
    .map((asset) => ({
      src: asset.web_path as string,
      title: `${floorLabel(floorId)} ${directionLabel(direction)}`,
      caption: asset.step_type ? `${capitalize(asset.step_type)} reference` : "Route reference"
    }));
}

export function getNodeImages(
  nodeId: string,
  context: Pick<RouteBuildContext, "placeById" | "nodeById" | "assetById">,
  limit = 2
) {
  const place = context.placeById.get(nodeId);
  const node = context.nodeById.get(nodeId);
  const assetIds = new Set<string>();

  if (place?.photo_assets?.storefront_asset_id) {
    assetIds.add(place.photo_assets.storefront_asset_id);
  }
  if (place?.photo_assets?.outward_view_asset_id) {
    assetIds.add(place.photo_assets.outward_view_asset_id);
  }
  for (const assetId of place?.photo_assets?.usable_reference_asset_ids ?? []) {
    assetIds.add(assetId);
  }
  for (const assetId of place?.photo_assets?.all_capture_asset_ids ?? []) {
    assetIds.add(assetId);
  }
  for (const assetId of node?.photo_assets ?? []) {
    assetIds.add(assetId);
  }
  if (node?.photo_asset_id) {
    assetIds.add(node.photo_asset_id);
  }

  return [...assetIds]
    .map((assetId) => context.assetById.get(assetId))
    .filter((asset): asset is AssetRecord => Boolean(asset?.web_path))
    .slice(0, limit)
    .map((asset, index) => ({
      src: asset.web_path as string,
      title: place?.name ?? node?.name ?? "Landmark photo",
      caption: index === 0 ? "Reference photo" : "Second view"
    }));
}

export function floorLabel(floorId: FloorId | null | undefined) {
  if (!floorId) {
    return "Floor change";
  }

  return FLOOR_LABELS[String(floorId)] ?? String(floorId).toUpperCase();
}

function directionLabel(direction: string | undefined) {
  if (direction === "counterclockwise") {
    return "counter-clockwise";
  }

  if (direction === "clockwise") {
    return "clockwise";
  }

  return direction ?? "ahead";
}

function getDisplayNode(nodeId: string, context: RouteBuildContext) {
  const place = context.placeById.get(nodeId);
  if (place) {
    return {
      id: place.id,
      type: place.type,
      name: place.name,
      floor_id: place.floor_id,
      unit: place.unit
    };
  }

  const node = context.nodeById.get(nodeId);
  if (node) {
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      floor_id: node.floor_id,
      unit: node.unit
    };
  }

  return {
    id: nodeId,
    type: "unknown",
    name: nodeId,
    floor_id: ""
  };
}

function locationLine(node: { floor_id?: FloorId; unit?: string | null }) {
  const parts = [floorLabel(node.floor_id)];
  if (node.unit) {
    parts.push(node.unit);
  }

  return parts.join(" - ");
}

function formatList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
