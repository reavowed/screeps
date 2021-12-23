import * as _ from "lodash";

export interface Position {
    x: number,
    y: number
}
export type DirectionOffset = -1 | 0 | 1;

function compare(a: number, b: number): DirectionOffset {
    return (a < b) ? -1 :
        (a > b) ? 1 : 0;
}

export class Direction {
    readonly dx: DirectionOffset;
    readonly dy: DirectionOffset;
    readonly constant: DirectionConstant;
    constructor(dx: DirectionOffset, dy: DirectionOffset, constant: DirectionConstant) {
        this.dx = dx;
        this.dy = dy;
        this.constant = constant;
    }

    addToPosition(position: Position): Position {
        return {
            x: position.x + this.dx,
            y: position.y + this.dy
        };
    }
}

export class MapUtils {
    static directionsByConstant: Record<DirectionConstant, Direction> = {
        [TOP]: new Direction(0, -1, TOP),
        [TOP_RIGHT]: new Direction(1, -1, TOP_RIGHT) ,
        [RIGHT]: new Direction(1, 0, RIGHT) ,
        [BOTTOM_RIGHT]: new Direction(1, 1, BOTTOM_RIGHT) ,
        [BOTTOM]: new Direction(0, 1, BOTTOM) ,
        [BOTTOM_LEFT]: new Direction(-1, 1, BOTTOM_LEFT) ,
        [LEFT]: new Direction(-1, 0, LEFT) ,
        [TOP_LEFT]: new Direction(-1, -1, TOP_LEFT)
    };
    static allDirections: Direction[] = _.values(MapUtils.directionsByConstant);
    static directionsByOffset: any = {
        [-1]: {
            [-1]: MapUtils.directionsByConstant[TOP_LEFT],
            0: MapUtils.directionsByConstant[LEFT],
            1: MapUtils.directionsByConstant[BOTTOM_LEFT]
        },
        0: {
            [-1]: MapUtils.directionsByConstant[TOP],
            1: MapUtils.directionsByConstant[BOTTOM]
        },
        1: {
            [-1]: MapUtils.directionsByConstant[TOP_RIGHT],
            0: MapUtils.directionsByConstant[RIGHT],
            1: MapUtils.directionsByConstant[BOTTOM_RIGHT]
        }
    };
    static getGeneralDirection(source: Position, target: Position): Direction {
        return this.directionsByOffset[compare(target.x, source.x)][compare(target.y, source.y)];
    }

    static getExactDirection(source: Position, target: Position): Direction {
        return MapUtils.directionsByOffset[target.x - source.x][target.y - source.y];
    }

    private static mapDirection(direction: Direction, f: (d: DirectionConstant) => DirectionConstant): Direction {
        return MapUtils.directionsByConstant[f(direction.constant)];
    }

    static clockwiseDirection(direction: Direction, increment = 1): Direction {
        return this.mapDirection(direction, c => this.clockwiseDirectionConstant(c, increment));
    }

    static clockwiseDirectionConstant(direction: DirectionConstant, increment = 1): DirectionConstant {
        return ((direction + increment - 1) % 8) + 1 as DirectionConstant;
    }

    static anticlockwiseDirection(direction: Direction, increment = 1) {
        return this.mapDirection(direction, c => this.anticlockwiseDirectionConstant(c, increment));
    }

    static anticlockwiseDirectionConstant(direction: DirectionConstant, increment = 1): DirectionConstant {
        return ((direction - increment + 7) % 8) + 1 as DirectionConstant;
    }

    static reverseDirection(direction: Direction): Direction {
        return this.mapDirection(direction, c => this.reverseDirectionConstant(c));
    }

    static reverseDirectionConstant(direction: DirectionConstant): DirectionConstant {
        return this.clockwiseDirectionConstant(direction, 4);
    }

    static findAdjacentFreeSpaces(room: Room, position: Position): Position[] {
        return _.chain(MapUtils.allDirections)
            .map((direction: Direction) => direction.addToPosition(position))
            .filter((adjacentPosition: Position) => this.isFree(room, adjacentPosition))
            .value();
    }

    static filterAdjacentSpaces(position: Position, otherPositions: Position[]) {
        return _.filter(otherPositions, p => this.areAdjacent(position, p));
    }

    static isFree(room: Room, position: Position): boolean {
        return this.getTerrain(room, position) !== TERRAIN_MASK_WALL && !this.hasStructure(room, position);
    }

    static isPlains(room: Room, position: Position): boolean {
        return this.getTerrain(room, position) === 0;
    }

    static getTerrain(room: Room, position: Position) {
        return this.getRoomTerrain(room).get(position.x, position.y);
    }

    static getRoomTerrain(room: Room): RoomTerrain {
        if (!(room as any).terrain) {
            (room as any).terrain = room.getTerrain();
        }
        return (room as any).terrain;
    }

    static hasStructure(room: Room, position: Position) {
        return !!_.find(this.getAllObjects(room)[position.y][position.x], o => o.type === "structure");
    }

    static getAllObjects(room: Room): LookAtResultMatrix {
        return (room as any).allObjects || ((room as any).allObjects = room.lookAtArea(0, 0, 49, 49));
    }

    static areSame(positionOne: Position, positionTwo: Position) {
        return positionOne.x === positionTwo.x && positionOne.y === positionTwo.y;
    }

    static areAdjacent(positionOne: Position, positionTwo: Position) {
        return this.getChebyshevDistance(positionOne, positionTwo) === 1;
    }

    static getChebyshevDistance(positionOne: Position, positionTwo: Position) {
        return Math.max(Math.abs(positionOne.x - positionTwo.x), Math.abs(positionOne.y - positionTwo.y));
    }

    static getManhattanDistance(positionOne: Position, positionTwo: Position) {
        return Math.abs(positionOne.x - positionTwo.x) + Math.abs(positionOne.y - positionTwo.y);
    }

    static reversePath(path: PathStep[]) {
        const reversedPath: PathStep[] = [];
        for (let i = path.length - 1; i >= 0; --i) {
            const {x, y, direction} = path[i];
            const newDirection = MapUtils.reverseDirection(MapUtils.directionsByConstant[direction]);
            const {x: newX, y: newY} = newDirection.addToPosition({x, y});
            reversedPath.push({
                x: newX,
                y: newY,
                dx: newDirection.dx,
                dy: newDirection.dy,
                direction: newDirection.constant
            });
        }
        return reversedPath;
    }
}
