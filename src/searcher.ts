import * as _ from "lodash";
import {Direction, MapUtils, Position} from "./utils.map";

function getPreferredDirections(source: Position, target: Position): Direction[] {
    const direction = MapUtils.getGeneralDirection(source, target);
    if (!direction) {
        return [];
    }
    return [
        direction,
        MapUtils.clockwiseDirection(direction, 1),
        MapUtils.anticlockwiseDirection(direction, 1),
        MapUtils.clockwiseDirection(direction, 2),
        MapUtils.anticlockwiseDirection(direction, 2),
        MapUtils.clockwiseDirection(direction, 3),
        MapUtils.anticlockwiseDirection(direction, 3),
        MapUtils.clockwiseDirection(direction, 4)
    ];
}

function isInBounds(position: Position): boolean {
    return position.x > 0 && position.x < 49 && position.y > 0 && position.y < 49;
}

interface SearchNode {
    parentNode: SearchNode | null
    position: Position
    estimatedCost: number
    costSoFar: number
    manhattanDistance: number
    chebyshevDistance: number
    nextDirections: Direction[]
}
interface SearchNodeWithCounter extends SearchNode {
    counter: number
}

function buildPath(node: SearchNode): PathStep[] | ERR_NO_PATH {
    const path = [];
    while (node.parentNode) {
        const direction = MapUtils.getExactDirection(node.parentNode.position, node.position);
        let position = node.parentNode.position;
        for (let i = 0; i < MapUtils.getChebyshevDistance(node.position, node.parentNode.position); ++i) {
            position = direction.addToPosition(position);
            path.unshift({
                x: position.x,
                y: position.y,
                dx: direction.dx,
                dy: direction.dy,
                direction: direction.constant
            });
        }
        node = node.parentNode;
    }
    return path;
}

class Queue {
    private internalArray: SearchNodeWithCounter[];
    private size: number;
    private counter: number;
    constructor() {
        this.internalArray = [];
        this.size = 0;
        this.counter = 1;
    }

    isHigherPriority(a: SearchNodeWithCounter, b: SearchNodeWithCounter) {
        return a.estimatedCost < b.estimatedCost ||
            (a.estimatedCost === b.estimatedCost && (
                a.manhattanDistance < b.manhattanDistance || (
                a.manhattanDistance === b.manhattanDistance &&
                a.counter > b.counter)))
    }

    add(node: SearchNode) {
        const index = this.size++;
        this.internalArray[index] = {
            ...node,
            counter: this.counter++
        };
        this.percolateUp(index);
    }

    peek(): SearchNode | void {
        if (this.size === 0)
            return;
        return this.internalArray[0];
    }

    pop(): SearchNode | void {
        if (this.size === 0)
            return;
        const value = this.internalArray[0];
        if (this.size > 1) {
            this.internalArray[0] = this.internalArray[--this.size];
            this.percolateDown(0);
        } else {
            this.size -= 1;
        }
        return value;
    }

    update(position: Position, f: (node: SearchNodeWithCounter) => SearchNodeWithCounter | void): boolean {
        for (let index = 0; index < this.size; ++index) {
            const value = this.internalArray[index];
            if (value.position.x === position.x && value.position.y === position.y) {
                const newNode = f(value);
                if (newNode) {
                    this.internalArray[index] = newNode;
                    this.percolateUp(index);
                }
                return true;
            }
        }
        return false;
    };

    percolateUp(index: number) {
        const value = this.internalArray[index];
        while (index > 0) {
            const parentIndex = (index - 1) >> 1;
            const parentValue = this.internalArray[parentIndex];
            if (!this.isHigherPriority(value, parentValue)) {
                break;
            }
            this.internalArray[index] = parentValue;
            index = parentIndex;
        }
        this.internalArray[index] = value;
    }

    percolateDown(index: number) {
        const value = this.internalArray[index];
        while (index < (this.size >>> 1)) {
            const leftChildIndex = (index << 1) + 1;
            const rightChildIndex = leftChildIndex + 1;
            let bestChildIndex = leftChildIndex;
            if (rightChildIndex < this.size) {
                if (this.isHigherPriority(this.internalArray[rightChildIndex], this.internalArray[leftChildIndex])) {
                    bestChildIndex = rightChildIndex;
                }
            }
            const bestChild = this.internalArray[bestChildIndex];
            if (!this.isHigherPriority(bestChild, value)) {
                break;
            }
            this.internalArray[index] = bestChild;
            index = bestChildIndex;
        }
        this.internalArray[index] = value;
    }
}

export class Searcher {
    private readonly room: Room;
    private readonly source: Position;
    private readonly target: Position;
    private readonly queue: Queue;
    private readonly closedStatus: Uint8Array;
    private readonly closedNodes: SearchNode[];
    private readonly costs: Uint8Array;
    private targetRange: number;

    constructor(room: Room, source: Position, target: Position) {
        this.room = room;
        this.source = source;
        this.target = target;
        this.queue = new Queue();
        this.closedStatus = new Uint8Array(2500);
        this.closedNodes = [];
        this.targetRange = 0;
        this.costs = this.loadCosts();
    }

    addOffset(position: Position, dx: number, dy: number): RoomPosition {
        return this.room.getPositionAt(position.x + dx, position.y + dy)!;
    }

    loadCosts(): Uint8Array {
        if (!(this.room as any).costs) {
            const terrainCosts = new Uint8Array(2500);
            (this.room as any).costs = terrainCosts;
            const terrain = this.room.getTerrain();
            for (let x = 0; x < 50; ++x) {
                for (let y = 0; y < 50; ++y) {
                    switch (terrain.get(x, y)) {
                        case TERRAIN_MASK_WALL:
                            terrainCosts[y * 50 + x] = 255;
                            break;
                        case TERRAIN_MASK_SWAMP:
                            terrainCosts[y * 50 + x] = 10;
                            break;
                        case 0:
                            terrainCosts[y * 50 + x] = 2;
                            break;
                    }
                }
            }
        }
        return (this.room as any).costs.slice(0);
    }

    avoidingPositions(positionsToAvoid: Position[]): Searcher {
        _.forEach(positionsToAvoid, ({x, y}) => this.costs[y * 50 + x] = 255);
        return this;
    }

    withTargetRange(targetRange: number): Searcher {
        this.targetRange = targetRange;
        return this;
    }

    isGoal(position: Position): boolean {
        return MapUtils.getChebyshevDistance(position, this.target) <= this.targetRange;
    }

    isObstructed(position: Position): boolean {
        return !isInBounds(position) || this.getCost(position) === 255;
    }

    getCost(position: Position): number {
        return this.costs[position.y * 50 + position.x];
    }

    close(node: SearchNode) {
        const {position} = node;
        this.closedNodes.push(node);
        this.closedStatus[position.y * 50 + position.x] = 1;
    }

    isClosed(position: Position): boolean {
        return this.closedStatus[position.y * 50 + position.x] === 1;
    }

    addNode(position: Position, parentNode: SearchNode | null, costSoFar: number, nextDirections: Direction[]) {
        if (this.isClosed(position)) {
            return;
        }
        const chebyshevDistance = MapUtils.getChebyshevDistance(position, this.target);
        const manhattanDistance = MapUtils.getManhattanDistance(position, this.target);
        const estimatedCost = costSoFar + 2 * chebyshevDistance;
        nextDirections = _.intersection(getPreferredDirections(position, this.target), nextDirections);
        const didUpdate = this.queue.update(position, node => {
            if (estimatedCost < node.estimatedCost) {
                return {
                    ...node,
                    parentNode,
                    costSoFar,
                    nextDirections,
                    chebyshevDistance,
                    manhattanDistance,
                    estimatedCost
                };
            }
        });
        if (!didUpdate) {
            this.queue.add({
                position,
                parentNode,
                costSoFar,
                nextDirections,
                chebyshevDistance,
                manhattanDistance,
                estimatedCost
            });
        }
    }

    searchFromNode(currentNode: SearchNode, direction: Direction) {
        const {dx, dy} = direction;
        const neighbourPosition = direction.addToPosition(currentNode.position);
        if (this.isObstructed(neighbourPosition)) {
            return;
        }
        const neighbourCost = this.getCost(neighbourPosition);
        const costSoFar = currentNode.costSoFar + neighbourCost;

        const nextDirections = [direction];
        const addIfForced = (travelPosition: Position, alternativePosition: Position, direction: Direction) => {
            if (!this.isObstructed(travelPosition) && this.getCost(alternativePosition) > neighbourCost) {
                nextDirections.push(direction);
            }
        };

        if (dy === 0) {
            // Moving horizontally
            addIfForced(this.addOffset(neighbourPosition, dx, -1), this.addOffset(neighbourPosition, 0, -1), MapUtils.directionsByOffset[dx][-1]);
            addIfForced(this.addOffset(neighbourPosition, dx, 1), this.addOffset(neighbourPosition, 0, 1), MapUtils.directionsByOffset[dx][1]);
        } else if (dx === 0) {
            // Moving vertically
            addIfForced(this.addOffset(neighbourPosition, -1, dy), this.addOffset(neighbourPosition, -1, 0), MapUtils.directionsByOffset[-1][dy]);
            addIfForced(this.addOffset(neighbourPosition, 1, dy), this.addOffset(neighbourPosition, 1, 0), MapUtils.directionsByOffset[1][dy]);
        } else {
            // Moving diagonally
            nextDirections.push(MapUtils.directionsByOffset[dx][0]);
            nextDirections.push(MapUtils.directionsByOffset[0][dy]);
            addIfForced(this.addOffset(currentNode.position, 0, 2 * dy), this.addOffset(currentNode.position, 0, dy), MapUtils.directionsByOffset[-dx][dy]);
            addIfForced(this.addOffset(currentNode.position, 2 * dx, 0), this.addOffset(currentNode.position, dx, 0), MapUtils.directionsByOffset[dx][-dy]);
        }
        this.addNode(neighbourPosition, currentNode, costSoFar, nextDirections);
    }

    findGoalNode(): SearchNode | ERR_NO_PATH {
        this.addNode(this.source, null, 0, getPreferredDirections(this.source, this.target));
        let currentNode;
        while (true) {
            currentNode = this.queue.peek();
            if (!currentNode) {
                return ERR_NO_PATH;
            }
            this.close(currentNode);
            if (this.isGoal(currentNode.position)) {
                return currentNode;
            }
            const direction = currentNode.nextDirections.shift()!;
            if (currentNode.nextDirections.length === 0) {
                this.queue.pop();
            }
            this.searchFromNode(currentNode, direction);
        }
    }

    findAllGoalNodes(): SearchNode[] {
        const results = [];
        this.addNode(this.source, null, 0, getPreferredDirections(this.source, this.target));
        let currentNode;
        while (true) {
            currentNode = this.queue.peek();
            if (!currentNode || (results.length && currentNode.costSoFar > results[0].costSoFar)) {
                return results;
            }
            this.close(currentNode);
            if (this.isGoal(currentNode.position) && !_.contains(results, currentNode)) {
                results.push(currentNode);
            }
            const direction = currentNode.nextDirections.shift()!;
            if (currentNode.nextDirections.length === 0) {
                this.queue.pop();
            }
            this.searchFromNode(currentNode, direction);
        }
    }

    findSinglePath(): PathStep[] | ERR_NO_PATH {
        const node = this.findGoalNode();
        if (node !== ERR_NO_PATH) {
            return buildPath(node);
        }
        return node;
    }

    findAllPaths(): (PathStep[] | ERR_NO_PATH)[] {
        return _.map(this.findAllGoalNodes(), buildPath);
    }


    findPathLength(): number | void {
        const node = this.findGoalNode();
        if (node !== ERR_NO_PATH) {
            return node.costSoFar / 2;
        }
    }

    static findPathLength(room: Room, source: Position, target: Position) {
        return new Searcher(room, source, target).findPathLength();
    }
}
