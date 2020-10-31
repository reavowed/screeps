const _ = require("lodash");
const MapUtils = require("./utils.map");

function getPreferredDirections(source, target) {
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

function isInBounds(position) {
    return position.x > 0 && position.x < 49 && position.y > 0 && position.y < 49;
}

function buildPath(node) {
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
    if (!path.length) {
        return ERR_NO_PATH;
    }
    return path;
}

class Queue {
    constructor() {
        this.internalArray = [];
        this.size = 0;
        this.counter = 1;
    }

    isHigherPriority(a, b) {
        return a.estimatedCost < b.estimatedCost ||
            (a.estimatedCost === b.estimatedCost && (
                a.manhattanDistance < b.manhattanDistance || (
                a.manhattanDistance === b.manhattanDistance &&
                a.counter > b.counter)))
    }

    add(node) {
        node.counter = this.counter++;
        const index = this.size++;
        this.internalArray[index] = node;
        this.percolateUp(index);
    }

    peek() {
        if (this.size === 0) return undefined;
        return this.internalArray[0];
    }

    pop() {
        if (this.size === 0)
            return undefined;
        const value = this.internalArray[0];
        if (this.size > 1) {
            this.internalArray[0] = this.internalArray[--this.size];
            this.percolateDown(0);
        } else {
            this.size -= 1;
        }
        return value;
    }

    update(position, f) {
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

    percolateUp(index) {
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

    percolateDown(index) {
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

class Searcher {
    constructor(room, source, target) {
        this.room = room;
        this.source = source;
        this.target = target;
        this.queue = new Queue();
        this.closedStatus = new Uint8Array(2500);
        this.closedNodes = [];
        this.targetRange = 0;
        this.loadCosts();
    }

    addOffset(position, dx, dy) {
        return this.room.getPositionAt(position.x + dx, position.y + dy);
    }

    loadCosts() {
        if (!this.room.terrainCosts) {
            this.room.terrainCosts = new Uint8Array(2500);
            const terrainLookup = this.room.lookAtArea(0, 0, 49, 49);
            for (let x = 0; x < 50; ++x) {
                for (let y = 0; y < 50; ++y) {
                    const terrain = _.find(terrainLookup[y][x], o => o.type === "terrain").terrain;
                    this.room.terrainCosts[y * 50 + x] = terrain === "plain" ? 2 :
                        terrain === "swamp" ? 10 :
                            255;
                }
            }
        }
        this.costs = this.room.terrainCosts.slice(0);
    }

    avoidingPositions(positionsToAvoid) {
        _.forEach(positionsToAvoid, ({x, y}) => this.costs[y * 50 + x] = 255);
        return this;
    }

    withTargetRange(targetRange) {
        this.targetRange = targetRange;
        return this;
    }

    isGoal(position) {
        return MapUtils.getChebyshevDistance(position, this.target) <= this.targetRange;
    }

    isObstructed(position) {
        return !isInBounds(position) || this.getCost(position) === 255;
    }

    getCost(position) {
        return this.costs[position.y * 50 + position.x];
    }

    close(node) {
        const {position} = node;
        this.closedNodes.push(node);
        this.closedStatus[position.y * 50 + position.x] = 1;
    }

    isClosed(position) {
        return this.closedStatus[position.y * 50 + position.x] === 1;
    }

    addNode(position, parentNode, costSoFar, nextDirections) {
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
                    parentNode, costSoFar, nextDirections, chebyshevDistance, manhattanDistance, estimatedCost
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

    searchFromNode(currentNode, direction) {
        const {dx, dy} = direction;
        const neighbourPosition = direction.addToPosition(currentNode.position);
        if (this.isObstructed(neighbourPosition)) {
            return;
        }
        const neighbourCost = this.getCost(neighbourPosition);
        const costSoFar = currentNode.costSoFar + neighbourCost;

        const nextDirections = [direction];
        const addIfForced = (travelPosition, alternativePosition, direction) => {
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

    findGoalNode() {
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
            const direction = currentNode.nextDirections.shift();
            if (currentNode.nextDirections.length === 0) {
                this.queue.pop();
            }
            this.searchFromNode(currentNode, direction);
        }
    }

    findAllGoalNodes() {
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
            const direction = currentNode.nextDirections.shift();
            if (currentNode.nextDirections.length === 0) {
                this.queue.pop();
            }
            this.searchFromNode(currentNode, direction);
        }
    }

    findSinglePath() {
        const node = this.findGoalNode();
        if (!(node < 0)) {
            return buildPath(node);
        }
        return node;
    }

    findAllPaths() {
        return _.map(this.findAllGoalNodes(), buildPath);
    }


    findPathLength() {
        const node = this.findGoalNode();
        if (!(node < 0)) {
            return node.costSoFar / 2;
        }
    }

    static findPathLength(room, source, target) {
        return new Searcher(room, source, target).findPathLength();
    }
}

module.exports = Searcher;
