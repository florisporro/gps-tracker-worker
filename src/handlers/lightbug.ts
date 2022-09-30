interface LightbugPayload {
	Type: string;
	MessageId: string;
	Message: string;
	UnsubscribeURL: string;
}

interface LightbugMessage {
	notification: {},
	datapoint: {
		location: {
			lat: number;
			lng: number;
		},
		timestamp: string,
		altitude: number,
		accuracy: number,
	}
}

export function lightbugPayloadToFrame(json: any) {
	function isLightbugPayload(payload: any): payload is LightbugPayload {
		return payload.Type !== undefined && payload.MessageId !== undefined;
	}
	function isLightbugMessage(payload: any): payload is LightbugMessage {
		return payload.datapoint !== undefined && payload.datapoint.location !== undefined;
	}

	if (!isLightbugPayload(json)) {
		return new Response("Invalid payload", { status: 400 })
	}
	
	const message = JSON.parse(json.Message) as LightbugMessage;
	
	if (!isLightbugMessage(message)) {
		return new Response("Invalid payload", { status: 400 })
	}

	return {
		position: {
			latitude: message.datapoint.location.lat,
			longitude: message.datapoint.location.lng
		},
		altitude: message.datapoint.altitude,
		accuracy: message.datapoint.accuracy,
		positionTimestamp: new Date(message.datapoint.timestamp).getTime()
	}
}