const EARTH_RADIUS = 6371000; // meters

/**
 * Haversine distance between two [lng, lat] points in meters.
 */
export function haversineDistance(coord1: [number, number], coord2: [number, number]): number {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLat = toRad(coord2[1] - coord1[1]);
    const dLng = toRad(coord2[0] - coord1[0]);
    const lat1 = toRad(coord1[1]);
    const lat2 = toRad(coord2[1]);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Geographic midpoint of two [lng, lat] points.
 */
export function geoMidpoint(c1: [number, number], c2: [number, number]): [number, number] {
    return [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
}

/**
 * Pixel midpoint of two {x, y} points.
 */
export function pixelMidpoint(p1: { x: number; y: number }, p2: { x: number; y: number }): { x: number; y: number } {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

/**
 * Euclidean distance between two pixel points.
 */
export function euclideanDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Format distance for display: "12.3 m" or "1.23 km".
 */
export function formatDistance(meters: number): string {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(1)} m`;
}
