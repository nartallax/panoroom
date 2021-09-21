export function toFixedNoTrail(v: number, positions: number): string {
	return v.toFixed(positions).replace(/\.?0+$/, "")
}