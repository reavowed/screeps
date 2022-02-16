import * as crypto from "crypto";

export function randomId() {
    return [...crypto.randomBytes(4)]
        .map(b => b.toString(16).padStart (2, "0"))
        .join ("");
}
