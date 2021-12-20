import Colony from "./room.colony";
import * as _ from "lodash";
import {MovementOverseerMemory} from "./movementOverseer";

type RoomType = "colony" | "deadColony" | "empty";
declare global {
    interface RoomMemory {
        type: RoomType,
        movement: MovementOverseerMemory
    }
    interface CreepMemory {
        colonyName: string
        role: string,
        move?: {
            tick: number
            path: PathStep[]
        }
    }
}

type ColoniesByRoomName = {[key: string]: Colony};

export class Mastermind {
    private readonly colonies: ColoniesByRoomName;

    constructor(colonies: {[key: string]: Colony}) {
        this.colonies = colonies;
    }

    static load(): Mastermind {
        const rooms = this.scanRooms();
        const colonies = this.loadColonies(rooms);
        return new Mastermind(colonies);
    }
    private static scanRooms(): Room[] {
        return _.map(Game.rooms, room => {
            if (!room.memory.type) {
                this.scanRoom(room);
            }
            return room;
        });
    }

    private static scanRoom(room: Room): void {
        if (room.controller && room.controller.my) {
            const colonyMemory = Colony.initialiseMemory(room);
            if (colonyMemory) {
                room.memory = colonyMemory;
            } else {
                room.memory = {
                    type: "deadColony",
                    movement: {}
                };
            }
        } else {
            room.memory.type = "empty";
        }
    }

    private static loadColonies(rooms: Room[]): ColoniesByRoomName {
        const colonies: ColoniesByRoomName = {}
        const creepsByColony = _.groupBy(Game.creeps, creep => creep.memory.colonyName);
        _.forEach(rooms, room => {
            if (room.controller && room.controller.my) {
                const colony = Colony.load(room, creepsByColony[room.name] || []);
                if (colony) {
                    colonies[room.name] = colony;
                }
            }
        });
        return colonies;
    }

    run() {
        _.forEach(this.colonies, colony => colony.runCreeps());
        _.forEach(this.colonies, colony => colony.buildCreeps());
    }
};
