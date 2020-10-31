const MapUtils = require("./utils.map");
const Searcher = require("./searcher");

const miner = {
    parts: [WORK, WORK, CARRY, MOVE],
    role: "miner"
};

module.exports = class EnergyMine {
    constructor(colony, memory, index) {
        this.colony = colony;
        this.memory = memory;
        this.index = index;
        this.source = Game.getObjectById(this.memory.sourceId);
        this.miners = [];
        this.minersByPosition = {};
    }

    getFromCache(key, lazyConstructor) {
        key = '_' + key;
        return this[key] || (this[key] = lazyConstructor());
    }

    get pathFromSpawn() {
        return this.getFromCache('pathFromSpawn', () => Room.deserializePath(this.memory.pathFromSpawn));
    }
    get pathToSpawn() {
        return this.getFromCache('pathToSpawn', () => Room.deserializePath(this.memory.pathToSpawn));
    }
    get miningPosition() {
        return this.getFromCache('miningPosition', () => this.colony.room.getPositionAt(this.memory.miningPosition.x, this.memory.miningPosition.y));
    }
    get droppedEnergy() {
        return this.getFromCache('droppedEnergy', () => this.miningPosition.lookFor(LOOK_ENERGY)[0]);
    }
    get mainMiner() {
        return this.minersByPosition[0];
    }

    initialise() {
        const possiblePositions = MapUtils.findAdjacentFreeSpaces(this.colony.room, this.source.pos);
        const positionEvaluations = _.filter(_.map(possiblePositions, position => this.evaluatePosition(position, possiblePositions)));
        const bestPosition = this.getBestPosition(positionEvaluations);
        this.initialiseMiningPosition(bestPosition, positionEvaluations);
    }

    evaluatePosition(position, possiblePositions) {
        const adjacentPositions = MapUtils.filterAdjacentSpaces(position, possiblePositions);
        let path = new Searcher(this.colony.room, this.colony.nest.spawn.pos, position).avoidingPositions(adjacentPositions).findSinglePath();
        if (path) {
            return {
                position,
                adjacentPositions,
                path,
                isPlains: MapUtils.isPlains(this.colony.room, position)
            }
        }
    }

    getBestPosition(positionEvaluations) {
        return _.sortByAll(
            positionEvaluations,
            [
                e => -1 * Math.min(2, e.adjacentPositions.length),
                e => e.isPlains ? 0 : 1,
                e => e.path.length,
                e => MapUtils.getManhattanDistance(this.colony.nest.spawn.pos, e.position)
            ]
        )[0];
    }

    initialiseMiningPosition(positionEvaluation) {
        // TODO: handle sources that need multiple mining positions?
        const childPositions = _.chain(positionEvaluation.adjacentPositions)
            .sortByAll([
                p => MapUtils.isPlains(this.colony.room, p) ? 0 : 1,
                p => MapUtils.getManhattanDistance(this.colony.nest.spawn.pos, p)
            ])
            .take(2)
            .value();
        const childPositionDirections = _.map(childPositions, p => MapUtils.getExactDirection(positionEvaluation.position, p).constant);
        this.memory.pathFromSpawn = Room.serializePath(positionEvaluation.path);
        this.memory.pathToSpawn = Room.serializePath(MapUtils.reversePath(positionEvaluation.path));
        this.memory.miningPosition = positionEvaluation.position;
        this.memory.childPositionDirections = childPositionDirections;
    }

    addCreep(creep) {
        this.miners.push(creep);
        if (creep.memory.task === "mine") {
            this.minersByPosition[creep.memory.direction] = creep;
        }
    }

    getFirstMinerCreepOrder() {
        return {spec: miner, memory: {mine: this.index, task: "move"}, directions: [this.pathFromSpawn[0].direction]};
    }

    getAllCreepOrders() {
        const numberOfMinersToRequest = this.memory.childPositionDirections.length + 1 - this.miners.length;
        return _.fill(Array(numberOfMinersToRequest), this.getFirstMinerCreepOrder());
    }

    runCreeps() {
        _.forEach(this.miners, miner => this.runMiner(miner));
        if (this.needToClearMainPosition && this.mainMiner) {
            this.clearMainPosition();
        } else if (!this.needToClearMainPosition && !this.mainMiner) {
            this.fillMainPosition();
        }
    }

    runMiner(miner) {
        if (miner.spawning) return;
        switch (miner.memory.task) {
            case "move":
                if (miner.fatigue === 0) {
                    miner.moveByPath(this.pathFromSpawn);
                    if (MapUtils.getChebyshevDistance(miner.pos, this.memory.miningPosition) === 1) {
                        this.needToClearMainPosition = true;
                        miner.memory.task = "mine";
                        miner.memory.direction = 0;
                    }
                }
                break;
            case "mine":
                miner.harvest(this.source);
                if (miner.memory.direction !== 0 && this.mainMiner) {
                    miner.transfer(this.mainMiner, RESOURCE_ENERGY);
                }
                if (miner.memory.direction === 0 && miner.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    miner.drop(RESOURCE_ENERGY);
                }
                break;
        }
    }

    clearMainPosition() {
        if (this.mainMiner) {
            const freeDirection = _.find(this.memory.childPositionDirections, d => !this.minersByPosition[d]);
            this.mainMiner.move(freeDirection);
            this.mainMiner.memory.direction = freeDirection;
        }
    }

    fillMainPosition() {
        const replacementMiner = _.find(this.minersByPosition);
        if (replacementMiner) {
            replacementMiner.move(MapUtils.reverseDirection(MapUtils.directionsByConstant[replacementMiner.memory.direction]).constant);
            replacementMiner.memory.direction = 0;
        }
    }
};
