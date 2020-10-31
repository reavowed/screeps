module.exports = class Nest {
    constructor(colony, memory) {
        this.colony = colony;
        this.memory = memory;
        this.spawn = Game.getObjectById(this.memory.spawnId);
        this.isSpawning = !!this.spawn.spawning;
    }

    get canSpawnNewCreep() {
        return !this.isSpawning;
    }

    get isCreepAboutToSpawn() {
        return this.spawn.spawning && this.spawn.spawning.remainingTime === 0;
    }

    spawnCreep(order) {
        if (!this.isSpawning) {
            const id = this.memory.nextCreepId || 1;
            const {spec: {parts, role}, ...options} = order;
            const name = role + "-" + this.colony.room.name + "-" + id;
            options.memory = {colony: this.colony.room.name, role, ...options.memory};
            const result = this.spawn.spawnCreep(parts, name, options);
            if (result === OK) {
                this.memory.nextCreepId = id + 1;
                this.isSpawning = true;
                return true;
            }
        }
        return false;
    }
};
