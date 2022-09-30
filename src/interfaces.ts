import { Frame } from "./frame";

export interface Position {
	latitude: number;
	longitude: number;
}

export interface NewFrame {
	position: Position,
	altitude?: number,
	positionTimestamp?: number,
  lastFrame?: Frame,
  accuracy?: number,
}

export interface TrackerMeta {
  name?: string;
	type?: string;
	meta?: any;
}