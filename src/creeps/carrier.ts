import {CreepSpec} from "../area.nest";
import {TypedCreep} from "../types";

export interface CarrierMemory {
    task: "mine" | "return"
    mineIndex: number
    returnDirection?: DirectionConstant
}
export type Carrier = TypedCreep<CarrierMemory>;
export const CarrierSpec: CreepSpec = {
    parts: [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
    role: "carrier"
};
