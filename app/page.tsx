"use client";

import { FormEvent, useMemo, useState } from "react";
import assetsData from "@/data/assets.json";
import edgesData from "@/data/edges.json";
import nodesData from "@/data/nodes.json";
import placesData from "@/data/places.json";
import routeSequencesData from "@/data/route_sequences.json";
import verticalConnectorsData from "@/data/vertical_connectors.json";
import {
  AssetRecord,
  ConnectorGroup,
  Edge,
  NodeRecord,
  Place,
  RouteResult,
  RouteStep,
  RouteSequence,
  buildConnectorPathMap,
  buildMapById,
  buildRouteSteps,
  findShortestRoute,
  floorLabel,
  getNodeImages,
  getStorePlaces
} from "@/lib/navigation";

type PlannerResult =
  | {
      status: "idle";
    }
  | {
      status: "same" | "ready";
      route: RouteResult;
      steps: RouteStep[];
    }
  | {
      status: "missing";
      message: string;
    };

const places = placesData as Place[];
const edges = (edgesData as { edges: Edge[] }).edges;
const nodes = (nodesData as { nodes: NodeRecord[] }).nodes;
const assets = (assetsData as { assets: AssetRecord[] }).assets;
const routeSequences = (routeSequencesData as { sequences: RouteSequence[] }).sequences;
const connectorGroups = (verticalConnectorsData as { connector_groups: ConnectorGroup[] })
  .connector_groups;

const stores = getStorePlaces(places);
const defaultStartId = stores[0]?.id ?? "";
const defaultDestinationId = stores[1]?.id ?? defaultStartId;

export default function Home() {
  const [startId, setStartId] = useState(defaultStartId);
  const [destinationId, setDestinationId] = useState(defaultDestinationId);
  const [result, setResult] = useState<PlannerResult>({ status: "idle" });

  const context = useMemo(() => {
    return {
      placeById: buildMapById(places),
      nodeById: buildMapById(nodes),
      assetById: buildMapById(assets),
      connectorPathById: buildConnectorPathMap(connectorGroups),
      sequences: routeSequences
    };
  }, []);

  const storesByFloor = useMemo(() => {
    return stores.reduce<Record<string, Place[]>>((groups, store) => {
      groups[store.floor_id] = groups[store.floor_id] ?? [];
      groups[store.floor_id].push(store);
      return groups;
    }, {});
  }, []);

  const selectedStart = context.placeById.get(startId);
  const selectedDestination = context.placeById.get(destinationId);
  const selectedImages = [
    ...getNodeImages(startId, context, 1).map((image) => ({
      ...image,
      title: selectedStart?.name ?? image.title,
      caption: "Current location"
    })),
    ...getNodeImages(destinationId, context, 1).map((image) => ({
      ...image,
      title: selectedDestination?.name ?? image.title,
      caption: "Destination"
    }))
  ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const route = findShortestRoute(edges, startId, destinationId);
    if (!route) {
      setResult({
        status: "missing",
        message: "No route was found with the current directed graph."
      });
      return;
    }

    setResult({
      status: route.edges.length === 0 ? "same" : "ready",
      route,
      steps: buildRouteSteps(route, context)
    });
  }

  return (
    <main className="app-shell">
      <section className="page-heading">
        <p className="eyebrow">B1 - L2 pilot</p>
        <h1>Plaza Sing Navigator</h1>
        <p>Landmark-guided routes through the mapped Plaza Singapura loops.</p>
      </section>

      <section className="planner-panel" aria-labelledby="planner-title">
        <div className="panel-heading">
          <h2 id="planner-title">Plan a Route</h2>
          <span>{stores.length} stores</span>
        </div>

        <form className="route-form" onSubmit={handleSubmit}>
          <StoreSelect
            id="start"
            label="Current location"
            value={startId}
            storesByFloor={storesByFloor}
            onChange={setStartId}
          />
          <StoreSelect
            id="destination"
            label="Destination"
            value={destinationId}
            storesByFloor={storesByFloor}
            onChange={setDestinationId}
          />

          <button className="primary-button" type="submit">
            Find Route
          </button>
        </form>
      </section>

      {selectedImages.length > 0 ? (
        <section className="photo-strip" aria-label="Selected landmark photos">
          {selectedImages.map((image, index) => (
            <figure className="image-card" key={`${image.src}-${index}`}>
              <img src={image.src} alt={image.title} />
              <figcaption>
                <span>{image.caption}</span>
                <strong>{image.title}</strong>
              </figcaption>
            </figure>
          ))}
        </section>
      ) : null}

      <section className="route-result" aria-live="polite" aria-label="Route result">
        <ResultView result={result} />
      </section>
    </main>
  );
}

type StoreSelectProps = {
  id: string;
  label: string;
  value: string;
  storesByFloor: Record<string, Place[]>;
  onChange: (value: string) => void;
};

function StoreSelect({ id, label, value, storesByFloor, onChange }: StoreSelectProps) {
  return (
    <label className="select-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {Object.entries(storesByFloor).map(([floorId, floorStores]) => (
          <optgroup key={floorId} label={floorLabel(floorId)}>
            {floorStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
                {store.unit ? ` (${store.unit})` : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function ResultView({ result }: { result: PlannerResult }) {
  if (result.status === "idle") {
    return (
      <div className="empty-state">
        <p className="eyebrow">Ready</p>
        <h2>Select two stores</h2>
        <p>The next route will use the directed graph in data/edges.json.</p>
      </div>
    );
  }

  if (result.status === "missing") {
    return (
      <div className="empty-state warning">
        <p className="eyebrow">No Route</p>
        <h2>Route unavailable</h2>
        <p>{result.message}</p>
      </div>
    );
  }

  return (
    <>
      <div className="result-summary">
        <div>
          <p className="eyebrow">{result.status === "same" ? "Same store" : "Route found"}</p>
          <h2>{result.status === "same" ? "You are already there" : "Follow these steps"}</h2>
        </div>
        <span>
          {result.route.edges.length} edge{result.route.edges.length === 1 ? "" : "s"}
        </span>
      </div>

      <ol className="route-list">
        {result.steps.map((step, index) => (
          <li className={`route-step ${step.kind === "connector" ? "floor-change" : ""}`} key={step.id}>
            <span className="step-number">{index + 1}</span>
            <div className="step-body">
              <div className="step-copy">
                {step.meta ? <p className="step-meta">{step.meta}</p> : null}
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>

              {step.fromLandmark || step.toLandmark ? (
                <dl className="landmark-list">
                  {step.fromLandmark ? (
                    <>
                      <dt>Entry</dt>
                      <dd>{step.fromLandmark}</dd>
                    </>
                  ) : null}
                  {step.toLandmark ? (
                    <>
                      <dt>Exit</dt>
                      <dd>{step.toLandmark}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}

              {step.images.length > 0 ? (
                <div className="step-images">
                  {step.images.map((image) => (
                    <figure className="image-card compact" key={`${step.id}-${image.src}`}>
                      <img src={image.src} alt={image.title} />
                      <figcaption>
                        <span>{image.caption}</span>
                        <strong>{image.title}</strong>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
