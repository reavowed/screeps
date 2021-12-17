const _ = require("lodash");
const MapUtils = require("./utils.map");
const Searcher = require("./searcher");

const miner = {
    parts: [WORK, WORK, CARRY, MOVE],
    role: "miner"
};

class SingleChild {
    constructor(index, directionFromMainPosition) {
        this.index = index;
        this.directionFromMainPosition = directionFromMainPosition;
    }

    addMiner(miner) {
        this.miner = miner;
    }

    get hasSpace() {
        return !this.miner;
    }

    get miners() {
        return _.filter([this.miner]);
    }

    get canReoccupyMain() {
        return !!this.miner;
    }

    reoccupyMain() {
        this.miner.move(MapUtils.reverseDirection(this.directionFromMainPosition));
        this.miner.memory.main = true;
        delete this.miner.memory.child;
    }

    moveMinerIn(miner) {
        miner.move(this.directionFromMainPosition);
        delete miner.memory.main;
        miner.memory.child = this.index;
    }

    rebalance() {}
}

class DoubleChild {
    constructor(index, directionFromMainPosition, directionFromFirstChild) {
        this.index = index;
        this.directionFromMainPosition = directionFromMainPosition;
        this.directionFromFirstChild = directionFromFirstChild;
    }

    addMiner(miner) {
        if (miner.memory.secondary) {
            this.secondaryMiner = miner;
        } else {
            this.primaryMiner = miner;
        }
    }

    get hasSpace() {
        return !this.primaryMiner || !this.secondaryMiner;
    }

    get miners() {
        return _.filter([this.primaryMiner, this.secondaryMiner]);
    }

    get canReoccupyMain() {
        return !!this.primaryMiner;
    }

    reoccupyMain() {
        this.primaryMiner.move(MapUtils.reverseDirection(this.directionFromMainPosition));
        this.primaryMiner.memory.main = true;
        delete this.primaryMiner.memory.child;
    }

    moveMinerIn(miner) {
        miner.move(this.directionFromMainPosition);
        delete miner.memory.main;
        miner.memory.child = this.index;
        miner.memory.secondary = false;

        if (this.primaryMiner) {
            this.primaryMiner.move(this.directionFromFirstChild);
            this.primaryMiner.memory.secondary = true;
        }
    }

    rebalance() {
        if (this.secondaryMiner && !this.primaryMiner) {
            this.secondaryMiner.move(MapUtils.reverseDirection(this.directionFromFirstChild));
            this.secondaryMiner.memory.secondary = false;
        }
    }
}

module.exports = class EnergyMine {
    constructor(colony, memory, index) {
        this.colony = colony;
        this.memory = memory;
        this.index = index;
        this.source = Game.getObjectById(this.memory.sourceId);
        this.miners = [];
    }

    load() {
        if (!this.memory.initialised) {
            this.initialise();
            this.memory.initialised = true;
        }
        this.miningPosition = this.colony.room.getPositionAt(this.memory.miningPosition.x, this.memory.miningPosition.y);
        this.miningPositionChildren = _.map(this.memory.miningPositionChildren, (direction, index) => _.isNumber(direction) ? new SingleChild(index, direction) : new DoubleChild(index, direction[0], direction[1]));
    }

    initialise() {
        const possiblePositions = MapUtils.findAdjacentFreeSpaces(this.colony.room, this.source.pos);
        const positionEvaluations = _.filter(_.map(possiblePositions, position => this.evaluatePosition(position, possiblePositions)));
        const {position, children} = this.getBestPositions(positionEvaluations)[0];
        this.memory.miningPosition = position;
        this.memory.miningPositionChildren = children;
    }

    evaluatePosition(position, possiblePositions) {
        const adjacentPositions = MapUtils.filterAdjacentSpaces(position, possiblePositions);
        let path = new Searcher(this.colony.room, this.colony.nest.spawn.pos, position).avoidingPositions(adjacentPositions).findSinglePath();
        if (path) {
            return {
                position,
                children: this.getBestChildren(position, possiblePositions),
                path,
                isPlains: MapUtils.isPlains(this.colony.room, position)
            }
        }
    }

    getBestChildren(position, possiblePositions) {
        const adjacentPositions = MapUtils.filterAdjacentSpaces(position, possiblePositions);
        if (adjacentPositions.length >= 2) {
            // 2 direct children
            return _.chain(this.orderChildPositions(adjacentPositions))
                .take(2)
                .map(p => MapUtils.getExactDirection(position, p).constant)
                .value();
        } else if (adjacentPositions.length === 1) {
            const nextAdjacentPositions = _.filter(MapUtils.filterAdjacentSpaces(adjacentPositions[0], possiblePositions), p => p !== position);
            if (nextAdjacentPositions.length) {
                // single child with it's own child
                return [[
                    MapUtils.getExactDirection(position, adjacentPositions[0]).constant,
                    MapUtils.getExactDirection(adjacentPositions[0], nextAdjacentPositions[0]).constant
                ]];
            } else {
                // single child with no children
                return [MapUtils.getExactDirection(position, adjacentPositions[0]).constant];
            }
        } else {
            // no children
            return [];
        }
    }

    orderChildPositions(childPositions) {
        return _.sortByAll(
            childPositions,
            [
                p => MapUtils.isPlains(this.colony.room, p) ? 0 : 1,
                p => MapUtils.getManhattanDistance(this.colony.nest.spawn.pos, p)
            ]);
    }

    getBestPositions(positionEvaluations) {
        // TODO: return multiple positions if needed
        const bestPosition = this.sortPositions(positionEvaluations)[0];
        if (bestPosition) {
            return [bestPosition];
        }
        return [];
    }

    sortPositions(positionEvaluations) {
        return _.sortByAll(
            positionEvaluations,
            [
                e => -1 * _.flatten(e.children).length,
                e => e.isPlains ? 0 : 1,
                e => e.path.length,
                e => MapUtils.getManhattanDistance(this.colony.nest.spawn.pos, e.position)
            ]
        );
    }

    addCreep(creep) {
        if (creep.memory.task === "move") {
            this.movers = this.movers || [];
            this.movers.push(creep);
        } else {
            if (creep.memory.main) {
                this.mainMiner = creep;
            } else if (_.isNumber(creep.memory.child)) {
                this.miningPositionChildren[creep.memory.child].addMiner(creep);
            }
        }
    }

    runCreeps() {
        this.movers && _.forEach(this.movers, mover => this.runMover(mover));
        this.mainMiner && this.runMainMiner(this.mainMiner);
        _.forEach(this.miningPositionChildren, child => {
            _.forEach(child.miners, miner => this.runChildMiner(miner));
            child.rebalance();
        });
        if (!this.mainMiner) {
            const childWithMiner = _.find(this.miningPositionChildren, child => child.canReoccupyMain);
            if (childWithMiner) {
                childWithMiner.reoccupyMain();
            }
        }

    }

    runMover(mover) {
        if (mover.fatigue === 0) {
            if (MapUtils.getChebyshevDistance(mover.pos, this.memory.miningPosition) > 1) {
                this.colony.movementOverseer.moveCreep(mover, this.memory.miningPosition);
            } else if (MapUtils.getChebyshevDistance(mover.pos, this.memory.miningPosition) === 1) {
                mover.move(MapUtils.getExactDirection(mover.pos, this.memory.miningPosition).constant);
                mover.memory.main = true;
                mover.memory.task = "mine";
                if (this.mainMiner) {
                    this.clearMainPosition();
                }
            }
        }
    }

    runMainMiner(miner) {
        miner.harvest(this.source);
        if (miner.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            miner.drop(RESOURCE_ENERGY);
        }
    }
    runChildMiner(miner) {
        miner.harvest(this.source);
        if (this.mainMiner && miner.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            miner.transfer(this.mainMiner, RESOURCE_ENERGY);
        }
    }

    clearMainPosition() {
        _.find(this.miningPositionChildren, "hasSpace").moveMinerIn(this.mainMiner);
    }

    get droppedEnergy() {
        return this.miningPosition.lookFor(LOOK_ENERGY)[0];
    }

    getFirstMinerCreepOrder() {
        return {spec: miner, memory: {mine: this.index, task: "move"}, directions: [this.pathFromSpawn[0].direction]};
    }

    getAllCreepOrders() {
        const numberOfMinersToRequest = this.memory.childPositionDirections.length + 1 - this.miners.length;
        return _.fill(Array(numberOfMinersToRequest), this.getFirstMinerCreepOrder());
    }
};
