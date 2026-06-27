"use client";

import { FormEvent, useMemo, useState } from "react";

type PhotoRole = "current" | "destination";

type VisionCandidate = {
  id: string;
  name: string;
  floor: string;
  unit: string;
  matchScore: number;
};

type VisionResponse =
  | {
      status: "ready";
      candidates: VisionCandidate[];
      confidence: number;
      evidence: string;
      needsConfirmation: boolean;
    }
  | { status: "error"; message: string };

type VisionAssistProps = {
  onConfirmedLocation: (input: {
    role: PhotoRole;
    storeId: string;
    message: string;
  }) => Promise<void>;
};

export function VisionAssist({ onConfirmedLocation }: VisionAssistProps) {
  const [role, setRole] = useState<PhotoRole>("current");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [response, setResponse] = useState<VisionResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRouting, setIsRouting] = useState(false);

  const helperText = useMemo(
    () =>
      role === "current"
        ? "Upload where you are, then say where you want to go."
        : "Upload your destination, then say where you are now.",
    [role]
  );

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setResponse(null);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setResponse({ status: "error", message: "Choose a photo first." });
      return;
    }

    setIsScanning(true);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("message", message);
      formData.append("photoRole", role);

      const apiResponse = await fetch("/api/vision", { method: "POST", body: formData });
      const payload = (await apiResponse.json()) as VisionResponse;
      setResponse(payload);
    } catch {
      setResponse({ status: "error", message: "Vision check failed. Try another image." });
    } finally {
      setIsScanning(false);
    }
  }

  async function confirmCandidate(candidate: VisionCandidate) {
    setIsRouting(true);
    try {
      await onConfirmedLocation({ role, storeId: candidate.id, message });
    } finally {
      setIsRouting(false);
    }
  }

  return (
    <section className="ai-panel" aria-labelledby="vision-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">OpenAI vision</p>
          <h2 id="vision-title">Confirm a landmark from a photo</h2>
        </div>
        <span>Vision</span>
      </div>

      <form className="ai-form" onSubmit={handleSubmit}>
        <label className="select-field" htmlFor="vision-role">
          <span>What does the photo show?</span>
          <select
            id="vision-role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as PhotoRole);
              setResponse(null);
            }}
          >
            <option value="current">My current location</option>
            <option value="destination">My destination</option>
          </select>
        </label>

        <label className="select-field" htmlFor="vision-image">
          <span>Upload a storefront or corridor photo</span>
          <input
            id="vision-image"
            type="file"
            accept="image/*"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          />
        </label>

        {previewUrl ? <img className="vision-preview" src={previewUrl} alt="Selected mall photo" /> : null}

        <label className="select-field" htmlFor="vision-message">
          <span>{helperText}</span>
          <input
            id="vision-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={role === "current" ? "How do I get to DBS?" : "I’m at UNIQLO."}
            maxLength={700}
          />
        </label>

        <button className="primary-button" type="submit" disabled={isScanning}>
          {isScanning ? "Checking landmark…" : "Find this landmark"}
        </button>
      </form>

      {response?.status === "error" ? <p className="ai-response">{response.message}</p> : null}

      {response?.status === "ready" ? (
        <div className="vision-result">
          <p className="ai-response">{response.evidence || "Please confirm the closest landmark."}</p>
          {response.candidates.length > 0 ? (
            <div className="candidate-list">
              {response.candidates.map((candidate) => (
                <button
                  className="candidate-button"
                  key={candidate.id}
                  type="button"
                  disabled={isRouting}
                  onClick={() => confirmCandidate(candidate)}
                >
                  <strong>{candidate.name}</strong>
                  <span>
                    {candidate.floor}
                    {candidate.unit ? ` · ${candidate.unit}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="ai-response">No confident match. Try a clearer photo with a sign or storefront in frame.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
