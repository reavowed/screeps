function compare(a, b) {
    return (a < b) ? -1 :
        (a > b) ? 1 : 0;
}

class Direction {
    constructor(dx, dy, constant) {
        this.dx = dx;
        this.dy = dy;
        this.constant = constant;
    }

    addToPosition(position) {
        return {
            x: position.x + this.dx,
            y: position.y + this.dy
        };
    }
}

class MapUtils {
    static getGeneralDirection(source, target) {
        return MapUtils.directionsByOffset[compare(target.x, source.x)][compare(target.y, source.y)];
    }

    static getExactDirection(source, target) {
        return MapUtils.directionsByOffset[target.x - source.x][target.y - source.y];
    }

    static clockwiseDirection(direction, increment = 1) {
        if (_.isNumber(direction)) {
            return ((direction + increment - 1) % 8) + 1;
        } else {
            return MapUtils.directionsByConstant[this.clockwiseDirection(direction.constant)];
        }
    }

    static anticlockwiseDirection(direction, increment = 1) {
        if (_.isNumber(direction)) {
            return ((direction - increment + 7) % 8) + 1;
        } else {
            return MapUtils.directionsByConstant[this.anticlockwiseDirection(direction.constant)];
        }
    }

    static reverseDirection(direction) {
        return this.clockwiseDirection(direction, 4);
    }

    static findAdjacentFreeSpaces(room, position) {
        return _.chain(MapUtils.allDirections)
            .map(direction => direction.addToPosition(position))
            .filter(adjacentPosition => this.isFree(room, adjacentPosition))
            .value();
    }

    static filterAdjacentSpaces(position, otherPositions) {
        return _.filter(otherPositions, p => this.areAdjacent(position, p));
    }

    static isFree(room, position) {
        return this.getTerrain(room, position) !== TERRAIN_MASK_WALL && !this.hasStructure(room, position);
    }

    static isPlains(room, position) {
        return this.getTerrain(room, position) === 0;
    }

    static getTerrain(room, position) {
        return this.getRoomTerrain(room).get(position.x, position.y);
    }

    static getRoomTerrain(room) {
        if (!room.terrain) {
            room.terrain = room.getTerrain();
        }
        return room.terrain;
    }

    static hasStructure(room, position) {
        return !!_.find(this.getAllObjects(room)[position.y][position.x], o => o.type === "structure");
    }

    static getAllObjects(room) {
        return room.allObjects || (room.allObjects = room.lookAtArea(0, 0, 49, 49));
    }

    static areSame(positionOne, positionTwo) {
        return positionOne.x === positionTwo.x && positionOne.y === positionTwo.y;
    }

    static areAdjacent(positionOne, positionTwo) {
        return this.getChebyshevDistance(positionOne, positionTwo) === 1;
    }

    static getChebyshevDistance(positionOne, positionTwo) {
        return Math.max(Math.abs(positionOne.x - positionTwo.x), Math.abs(positionOne.y - positionTwo.y));
    }

    static getManhattanDistance(positionOne, positionTwo) {
        return Math.abs(positionOne.x - positionTwo.x) + Math.abs(positionOne.y - positionTwo.y);
    }

    static reversePath(path) {
        const reversedPath = [];
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

MapUtils.directionsByConstant = [
    undefined,
    new Direction(0, -1, TOP),
    new Direction(1, -1, TOP_RIGHT),
    new Direction(1, 0, RIGHT),
    new Direction(1, 1, BOTTOM_RIGHT),
    new Direction(0, 1, BOTTOM),
    new Direction(-1, 1, BOTTOM_LEFT),
    new Direction(-1, 0, LEFT),
    new Direction(-1, -1, TOP_LEFT)
];
MapUtils.allDirections = MapUtils.directionsByConstant.slice(1);
MapUtils.directionsByOffset = {
    "-1": {
        "-1": MapUtils.directionsByConstant[TOP_LEFT],
        0: MapUtils.directionsByConstant[LEFT],
        1: MapUtils.directionsByConstant[BOTTOM_LEFT]
    },
    0: {
        "-1": MapUtils.directionsByConstant[TOP],
        1: MapUtils.directionsByConstant[BOTTOM]
    },
    1: {
        "-1": MapUtils.directionsByConstant[TOP_RIGHT],
        0: MapUtils.directionsByConstant[RIGHT],
        1: MapUtils.directionsByConstant[BOTTOM_RIGHT]
    }
};
module.exports = MapUtils;
