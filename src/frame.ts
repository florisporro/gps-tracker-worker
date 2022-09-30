import { Position, NewFrame } from "./interfaces"

export class Frame {
	readonly frameno: number;
	position: Position;
	altitude: number;
	accuracy: number;
	frameTimestamp: number;
	positionTimestamp?: number;

	constructor(newFrame: NewFrame) {
    this.frameno = 0
    if (newFrame.lastFrame) {
      this.frameno = newFrame.lastFrame.frameno + 1 || 0;
    }
		this.position = newFrame.position;
		this.altitude = newFrame.altitude || 0;
		this.accuracy = newFrame.accuracy || 0;
		this.frameTimestamp = Date.now();
		this.positionTimestamp = newFrame.positionTimestamp || Date.now();
	}
}