export interface TypedCreep<T> extends Creep {
    memory: T & CreepMemory;
}

export type CreepMap = { [creepName: string]: Creep };
