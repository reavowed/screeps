import Colony from "./room.colony";
import {Position} from "./utils.map";

const Searcher = require("./searcher");

export interface MovementOverseerMemory {}

export class MovementOverseer {
    private readonly colony: Colony;
    private readonly memory: MovementOverseerMemory;

    constructor(colony: Colony, memory: MovementOverseerMemory) {
        this.colony = colony;
        this.memory = memory;
    }

    moveCreep(creep: Creep, targetPosition: Position) {
        if (creep.memory.move && creep.memory.move.tick === (Game.time - 1)) {
            creep.moveByPath(creep.memory.move.path);
            creep.memory.move.tick = Game.time;
        } else {
            const path = new Searcher(creep.room, creep.pos, targetPosition).findSinglePath();
            creep.memory.move = {
                path,
                tick: Game.time
            };
            creep.moveByPath(path);
        }
    }
};
