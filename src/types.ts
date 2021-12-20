export interface TypedCreep<T> extends Creep {
    memory: T & CreepMemory;
}
