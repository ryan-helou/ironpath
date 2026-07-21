import { Discipline, PaceModel, Zone } from "./types";
import { ZONES, rpeLabel } from "./zones";
import { fmtPaceRange, fmtPace100Range } from "./format";

// Render a segment's zone into concrete, athlete-specific targets.

export interface TargetView {
  primary: string; // the headline number, e.g. "4:30–4:45/km"
  secondary: string[]; // supporting metrics
  zoneName: string;
}

export function targetView(discipline: Discipline, zone: Zone, paces: PaceModel): TargetView {
  const meta = ZONES[zone];
  const secondary: string[] = [rpeLabel(zone)];

  if (discipline === "run") {
    const z = paces.run.zones[zone];
    const hr = paces.hr.zones[zone];
    if (paces.hr.maxHR && hr.loBpm) secondary.push(`${hr.loBpm}–${hr.hiBpm} bpm`);
    return {
      primary: fmtPaceRange(z.loSecPerKm, z.hiSecPerKm),
      secondary,
      zoneName: meta.name,
    };
  }
  if (discipline === "swim") {
    const z = paces.swim.zones[zone];
    return {
      primary: fmtPace100Range(z.loSecPer100, z.hiSecPer100),
      secondary,
      zoneName: meta.name,
    };
  }
  if (discipline === "bike") {
    const z = paces.bike.zones[zone];
    let primary: string;
    if (paces.bike.ftp && z.loW) {
      primary = `${z.loW}–${z.hiW} W`;
      secondary.unshift(`${z.loPct}–${z.hiPct}% FTP`);
    } else {
      primary = `${z.loPct}–${z.hiPct}% FTP`;
    }
    const hr = paces.hr.zones[zone];
    if (paces.hr.maxHR && hr.loBpm) secondary.push(`${hr.loBpm}–${hr.hiBpm} bpm`);
    return { primary, secondary, zoneName: meta.name };
  }
  // strength / rest / brick container
  return { primary: meta.name, secondary, zoneName: meta.name };
}
