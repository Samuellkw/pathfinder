import profilesData from "@/data/store_profiles.json";
import { RouteResult, RouteStep } from "@/lib/navigation";
import {
  buildRouteForStores,
  getStoreById,
  resolveStore
} from "@/lib/mall-runtime";

export type StoreProfile = {
  node_id: string;
  category: "shopping" | "meal" | "dessert";
  tags: string[];
  duration_minutes: number;
  estimated_spend_sgd: number;
  price_level: number;
};

export type ConciergeConstraints = {
  duration_minutes: number;
  budget_sgd: number;
  party: string;
  interests: string[];
  needs_shopping: boolean;
  needs_meal: boolean;
  needs_dessert: boolean;
  start_query: string;
};

export type ItineraryStop = {
  node_id: string;
  name: string;
  floor: string;
  category: StoreProfile["category"];
  duration_minutes: number;
  estimated_spend_sgd: number;
  reason: string;
};

export type ItinerarySegment = {
  from_node_id: string;
  to_node_id: string;
  route: RouteResult;
  steps: RouteStep[];
  estimated_walk_minutes: number;
};

const profiles = (profilesData as { profiles: StoreProfile[] }).profiles;

function normaliseTag(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasInterest(profile: StoreProfile, interests: string[]) {
  const tags = profile.tags.map(normaliseTag);
  return interests.some((interest) => {
    const normalized = normaliseTag(interest);
    return tags.some((tag) => tag.includes(normalized) || normalized.includes(tag));
  });
}

function scoreProfile(profile: StoreProfile, constraints: ConciergeConstraints, usedIds: Set<string>) {
  if (usedIds.has(profile.node_id)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  if (hasInterest(profile, constraints.interests)) score += 12;
  if (constraints.party.toLowerCase().includes("date") && profile.tags.includes("date")) score += 8;
  if (constraints.budget_sgd > 0 && profile.estimated_spend_sgd <= constraints.budget_sgd) score += 3;
  if (constraints.budget_sgd > 0 && profile.estimated_spend_sgd > constraints.budget_sgd) score -= 6;
  return score;
}

function chooseStop(
  category: StoreProfile["category"],
  constraints: ConciergeConstraints,
  usedIds: Set<string>
) {
  const profile = profiles
    .filter((item) => item.category === category)
    .sort((a, b) => scoreProfile(b, constraints, usedIds) - scoreProfile(a, constraints, usedIds))[0];

  if (!profile) return undefined;
  const store = getStoreById(profile.node_id);
  if (!store) return undefined;

  usedIds.add(profile.node_id);
  const matchingTags = profile.tags.filter((tag) => hasInterest({ ...profile, tags: [tag] }, constraints.interests));
  const reason = matchingTags.length
    ? `Matches your ${matchingTags.join(", ")} preference${matchingTags.length === 1 ? "" : "s"}.`
    : profile.tags.includes("date") && constraints.party.toLowerCase().includes("date")
      ? "A date-friendly stop in the mapped pilot zone."
      : "A practical fit for your available time.";

  return {
    node_id: store.id,
    name: store.name,
    floor: store.floor_display ?? store.floor_id,
    category,
    duration_minutes: profile.duration_minutes,
    estimated_spend_sgd: profile.estimated_spend_sgd,
    reason
  } satisfies ItineraryStop;
}

export function buildConciergePlan(constraints: ConciergeConstraints) {
  const usedIds = new Set<string>();
  const stops: ItineraryStop[] = [];

  const wantsShopping = constraints.needs_shopping || constraints.interests.some((item) =>
    ["fashion", "shopping", "gift", "gifts", "shoes", "running", "sports", "stationery"].includes(normaliseTag(item))
  );
  const wantsMeal = constraints.needs_meal || constraints.party.toLowerCase().includes("date");
  const wantsDessert = constraints.needs_dessert || constraints.party.toLowerCase().includes("date");

  if (wantsShopping) {
    const shopping = chooseStop("shopping", constraints, usedIds);
    if (shopping) stops.push(shopping);
  }
  if (wantsMeal) {
    const meal = chooseStop("meal", constraints, usedIds);
    if (meal) stops.push(meal);
  }
  if (wantsDessert) {
    const dessert = chooseStop("dessert", constraints, usedIds);
    if (dessert) stops.push(dessert);
  }

  if (stops.length === 0) {
    const fallback = chooseStop("shopping", constraints, usedIds);
    if (fallback) stops.push(fallback);
  }

  const startStore = resolveStore(constraints.start_query).store;
  const routeNodeIds = startStore ? [startStore.id, ...stops.map((stop) => stop.node_id)] : stops.map((stop) => stop.node_id);
  const segments: ItinerarySegment[] = [];

  for (let index = 0; index < routeNodeIds.length - 1; index += 1) {
    const navigation = buildRouteForStores(routeNodeIds[index], routeNodeIds[index + 1]);
    if (!navigation) continue;

    segments.push({
      from_node_id: routeNodeIds[index],
      to_node_id: routeNodeIds[index + 1],
      route: navigation.route,
      steps: navigation.steps,
      estimated_walk_minutes: Math.max(2, Math.ceil(navigation.route.edges.length * 1.2))
    });
  }

  const activityMinutes = stops.reduce((sum, stop) => sum + stop.duration_minutes, 0);
  const walkingMinutes = segments.reduce((sum, segment) => sum + segment.estimated_walk_minutes, 0);
  const estimatedSpend = stops.reduce((sum, stop) => sum + stop.estimated_spend_sgd, 0);

  return {
    start: startStore
      ? { id: startStore.id, name: startStore.name, floor: startStore.floor_display ?? startStore.floor_id }
      : null,
    stops,
    segments,
    estimated_total_minutes: activityMinutes + walkingMinutes,
    estimated_total_spend_sgd: estimatedSpend,
    fits_duration: constraints.duration_minutes <= 0 || activityMinutes + walkingMinutes <= constraints.duration_minutes,
    fits_budget: constraints.budget_sgd <= 0 || estimatedSpend <= constraints.budget_sgd
  };
}
