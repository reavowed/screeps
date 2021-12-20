import Colony from "./room.colony";

export interface NestMemory {
    spawnId: Id<StructureSpawn>,
    nextCreepId: number;
}

export interface CreepSpec {
    parts: BodyPartConstant[],
    role: string
}
export interface CreepOrder<T> {
    spec: CreepSpec,
    options?: {
        memory?: T
        directions?: DirectionConstant[]
    }
}

export class Nest {
    readonly colony: Colony;
    readonly memory: NestMemory;
    readonly spawn: StructureSpawn;
    isSpawning: boolean;
    constructor(colony: Colony, memory: NestMemory) {
        this.colony = colony;
        this.memory = memory;
        this.spawn = Game.getObjectById(this.memory.spawnId)!;
        this.isSpawning = !!this.spawn.spawning;
    }

    get canSpawnNewCreep(): boolean {
        return !this.isSpawning;
    }

    get isCreepAboutToSpawn(): boolean {
        return !!this.spawn.spawning && this.spawn.spawning.remainingTime === 0;
    }

    spawnCreep(order: CreepOrder<any>): boolean {
        if (!this.isSpawning) {
            order.options = order.options || {};
            const id = this.memory.nextCreepId || 1;
            const {spec: {parts, role}, options} = order;
            const name = role + "-" + this.colony.room.name + "-" + id;
            options.memory = {colonyName: this.colony.room.name, role, ...options.memory};
            const result = this.spawn.spawnCreep(parts, name, options);
            if (result === OK) {
                this.memory.nextCreepId = id + 1;
                this.isSpawning = true;
                return true;
            }
        }
        return false;
    }
}
