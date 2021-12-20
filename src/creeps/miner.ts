import {CreepSpec} from "../area.nest";
import {TypedCreep} from "../types";

export interface MinerMemory {
    task: "move" | "mine"
    mineIndex: number
    isMain?: boolean
    isSecondary?: boolean
    childIndex?: number
}
export type Miner = TypedCreep<MinerMemory>;

export const MinerSpec: CreepSpec = {
    parts: [WORK, WORK, CARRY, MOVE],
    role: "miner"
};
