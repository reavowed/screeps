const Searcher = require("./searcher");

module.exports = class MovementOverseer {
    constructor(colony, memory) {
        this.colony = colony;
        this.memory = memory;
    }

    get positionsToAvoid() {
        return _.flatten()
    }

    moveCreep(creep, targetPosition) {
        if (creep.memory.move && creep.memory.move.tick === (Game.time - 1)) {
            creep.moveByPath(creep.memory.move.path);
            creep.memory.move.tick = Game.time;
        } else {
            const path = new Searcher(creep.room, creep.pos, targetPosition).avoidingPositions(this.positionsToAvoid).findSinglePath();
            creep.memory.move = {
                path,
                tick: Game.time
            };
            creep.moveByPath(path);
        }
    }
};
