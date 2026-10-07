"use client";

import { useEffect, useState } from "react";

type Props = { initial?: { make?: string; model?: string; year?: string } };

async function load(qs: string) {
  const res = await fetch(`/api/vehicles${qs}`);
  return res.json();
}

export default function VehicleSelector({ initial = {} }: Props) {
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [make, setMake] = useState(initial.make ?? "");
  const [model, setModel] = useState(initial.model ?? "");
  const [year, setYear] = useState(initial.year ?? "");

  useEffect(() => {
    load("").then((d) => setMakes(d.makes));
  }, []);
  useEffect(() => {
    if (!make) return;
    load(`?make=${encodeURIComponent(make)}`).then((d) => setModels(d.models));
  }, [make]);
  useEffect(() => {
    if (!make || !model) return;
    load(`?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`).then((d) =>
      setYears(d.years),
    );
  }, [make, model]);

  // Remember the last car so it's pre-selected next visit ("My Garage").
  useEffect(() => {
    try {
      if (make) localStorage.setItem("garage", JSON.stringify({ make, model, year }));
    } catch {}
  }, [make, model, year]);
  useEffect(() => {
    if (initial.make) return;
    /* eslint-disable react-hooks/set-state-in-effect -- restoring client-only saved state after mount */
    try {
      const g = JSON.parse(localStorage.getItem("garage") ?? "null");
      if (g?.make) {
        setMake(g.make);
        setModel(g.model ?? "");
        setYear(g.year ?? "");
      }
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <select
        name="make"
        value={make}
        onChange={(e) => {
          setMake(e.target.value);
          setModel("");
          setYear("");
          setModels([]);
          setYears([]);
        }}
        aria-label="Make"
      >
        <option value="">Make</option>
        {makes.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <select
        name="model"
        value={model}
        disabled={!make}
        onChange={(e) => {
          setModel(e.target.value);
          setYear("");
          setYears([]);
        }}
        aria-label="Model"
      >
        <option value="">Model</option>
        {models.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <select name="year" value={year} disabled={!model} onChange={(e) => setYear(e.target.value)} aria-label="Year">
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
    </>
  );
}
