import Colony from "./room.colony";
import {MapUtils, Position} from "./utils.map";
import {Searcher} from "./searcher";

export interface MovementOverseerMemory {}

export class MovementOverseerFactory {
    create(colony: Colony): MovementOverseer {
        return new MovementOverseer(colony, colony.memory.movement);
    }
}

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
            if (path !== ERR_NO_PATH) {
                creep.memory.move = {
                    path,
                    tick: Game.time
                };
                creep.moveByPath(path);
            }
        }
    }

    moveCreepByPath(creep: Creep, path: PathStep[]): void {
        creep.moveByPath(path);
    }

    moveCreepBackwardsByPath(creep: Creep, path: PathStep[]): void {
        this.moveCreepByPath(creep, MapUtils.reversePath(path));
    }
};
