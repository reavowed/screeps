
export function randomId() {
    const buffer = new ArrayBuffer(8);
    const floatArray = new Float64Array(buffer);
    floatArray[0] = Math.random();
    return new Array(new Uint8Array (buffer).slice(0, 4))
        .map (b => b.toString(16).padStart (2, "0"))
        .join ("");
}
