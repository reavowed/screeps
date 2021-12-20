import {Position} from "./utils.map";
import * as _ from "lodash";
import Colony from "./room.colony";
import {Miner, MinerMemory, MinerSpec} from "./creeps/miner";
import {isDefined} from "./utils";
import {CreepOrder} from "./area.nest";

const MapUtils = require("./utils.map");
const Searcher = require("./searcher");

export interface EnergyMineMemory {
    sourceId: Id<Source>
    miningPosition: Position
    pathToMiningPosition: PathStep[]
    miningPositionChildrenType: ChildrenType
    miningPositionChildrenDirections: DirectionConstant[]
}

interface MiningPositionChild {
    get hasSpace(): boolean
    get miners(): Miner[]
    get canReoccupyMain(): boolean
    reoccupyMain(): void
    moveMinerIn(miner: Miner): void
    rebalance(): void
}

type ChildrenType = "single" | "twoSingle" | "double" | "none"

interface PositionEvaluation {
    position: Position,
    numberOfChildren: number,
    childrenType: ChildrenType
    childrenDirections: DirectionConstant[]
    path: PathStep[],
    isPlains: boolean
}

class SingleChild implements MiningPositionChild {
    private readonly index: number;
    private readonly directionFromMainPosition: DirectionConstant;
    private readonly miner?: Miner;

    constructor(index: number, energyMine: EnergyMine) {
        this.index = index;
        this.directionFromMainPosition = energyMine.memory.miningPositionChildrenDirections[index];
        this.miner = _.find(energyMine.miners, m => m.memory.childIndex == index);
    }

    get hasSpace() {
        return !this.miner;
    }

    get miners(): Miner[] {
        return this.miner ? [this.miner] : [];
    }

    get canReoccupyMain() {
        return !!this.miner;
    }

    reoccupyMain() {
        if (this.miner) {
            this.miner.move(MapUtils.reverseDirectionConstant(this.directionFromMainPosition));
            this.miner.memory.isMain = true;
            delete this.miner.memory.childIndex;
        }
    }

    moveMinerIn(miner: Miner) {
        miner.move(this.directionFromMainPosition);
        miner.memory.childIndex = this.index;
        delete miner.memory.isMain;
    }

    rebalance() {}
}

class DoubleChild implements MiningPositionChild {
    readonly index: number;
    readonly directionFromMainPosition: DirectionConstant;
    readonly directionFromFirstChild: DirectionConstant;
    readonly primaryMiner?: Miner;
    readonly secondaryMiner?: Miner;

    constructor(index: number, energyMine: EnergyMine) {
        this.index = index;
        this.directionFromMainPosition = energyMine.memory.miningPositionChildrenDirections[index];
        this.directionFromFirstChild = energyMine.memory.miningPositionChildrenDirections[index + 1];
        this.primaryMiner = _.find(energyMine.miners, m => m.memory.childIndex == index && !m.memory.isSecondary);
        this.secondaryMiner = _.find(energyMine.miners, m => m.memory.childIndex == index && m.memory.isSecondary);
    }

    get hasSpace() {
        return !this.primaryMiner || !this.secondaryMiner;
    }

    get miners() {
        const miners = [];
        if (this.primaryMiner) miners.push(this.primaryMiner);
        if (this.secondaryMiner) miners.push(this.secondaryMiner);
        return miners;
    }

    get canReoccupyMain() {
        return !!this.primaryMiner;
    }

    reoccupyMain() {
        if (this.primaryMiner) {
            this.primaryMiner.move(MapUtils.reverseDirectionConstant(this.directionFromMainPosition));
            this.primaryMiner.memory.isMain = true;
            delete this.primaryMiner.memory.childIndex;
        }
    }

    moveMinerIn(miner: Miner) {
        miner.move(this.directionFromMainPosition);
        miner.memory.childIndex = this.index;
        delete miner.memory.isMain;
        delete miner.memory.isSecondary;

        if (this.primaryMiner) {
            this.primaryMiner.move(this.directionFromFirstChild);
            this.primaryMiner.memory.isSecondary = true;
        }
    }

    rebalance() {
        if (this.secondaryMiner && !this.primaryMiner) {
            this.secondaryMiner.move(MapUtils.reverseDirectionConstant(this.directionFromFirstChild));
            this.secondaryMiner.memory.isSecondary = false;
        }
    }
}

export class EnergyMine {
    readonly colony: Colony;
    readonly memory: EnergyMineMemory;
    readonly index: number;
    readonly source: Source;
    readonly movers: Miner[];
    readonly miners: Miner[];
    readonly miningPosition: RoomPosition;
    readonly miningPositionChildren: MiningPositionChild[];
    readonly mainMiner?: Miner;

    constructor(colony: Colony, memory: EnergyMineMemory, index: number, creeps: Creep[]) {
        this.colony = colony;
        this.memory = memory;
        this.index = index;
        this.source = Game.getObjectById(this.memory.sourceId)!;
        this.movers = _.filter(creeps as Miner[], m => m.memory.task == "move");
        this.miners = _.filter(creeps as Miner[], m => m.memory.task == "mine");
        this.miningPosition = this.colony.room.getPositionAt(this.memory.miningPosition.x, this.memory.miningPosition.y)!;
        this.miningPositionChildren = this.readChildren();
        this.mainMiner = _.find(this.miners, m => m.memory.isMain);
    }

    readChildren(): MiningPositionChild[] {
        switch (this.memory.miningPositionChildrenType) {
            case "none":
                return [];
            case "single":
                return [new SingleChild(0, this)];
            case "twoSingle":
                return [
                    new SingleChild(0, this),
                    new SingleChild(1, this)
                ];
            case "double":
                return [new DoubleChild(0, this)];
        }
    }

    static initialiseMemory(source: Source, spawn: StructureSpawn): EnergyMineMemory {
        const possibleMiningPositions = MapUtils.findAdjacentFreeSpaces(source.room, source.pos);
        const positionEvaluations = possibleMiningPositions
            .map((position: Position) => this.evaluateMiningPosition(position, possibleMiningPositions, spawn))
            .filter(isDefined);
        const {position, path, childrenType, childrenDirections} = this.getBestPositions(positionEvaluations, spawn)[0];
        return {
            sourceId: source.id,
            miningPosition: position,
            pathToMiningPosition: path,
            miningPositionChildrenType: childrenType,
            miningPositionChildrenDirections: childrenDirections
        }
    }

    static evaluateMiningPosition(candidatePosition: Position, allPossibleMiningPositions: Position[], spawn: StructureSpawn): PositionEvaluation | undefined {
        const adjacentMiningPositions = MapUtils.filterAdjacentSpaces(candidatePosition, allPossibleMiningPositions);
        let path = new Searcher(spawn.room, spawn.pos, candidatePosition).avoidingPositions(adjacentMiningPositions).findSinglePath();
        if (path) {
            const { numberOfChildren, childrenType, childrenDirections } = this.getBestChildren(candidatePosition, allPossibleMiningPositions, spawn)
            return {
                position: candidatePosition,
                numberOfChildren,
                childrenType,
                childrenDirections,
                path,
                isPlains: MapUtils.isPlains(spawn.room, candidatePosition)
            }
        }
    }

    static getBestChildren(candidatePosition: Position, allPossibleMiningPositions: Position[], spawn: StructureSpawn): { numberOfChildren: number, childrenType: ChildrenType, childrenDirections: DirectionConstant[] } {
        const adjacentPositions = MapUtils.filterAdjacentSpaces(candidatePosition, allPossibleMiningPositions);
        if (adjacentPositions.length >= 2) {
            // 2 direct children
            const childrenDirections = _.chain(this.orderChildPositions(adjacentPositions, spawn))
                .take(2)
                .map((p: Position) => MapUtils.getExactDirection(candidatePosition, p).constant)
                .value();
            return {
                numberOfChildren: 2,
                childrenType: "twoSingle",
                childrenDirections
            };
        } else if (adjacentPositions.length === 1) {
            const nextAdjacentPositions = _.filter(MapUtils.filterAdjacentSpaces(adjacentPositions[0], allPossibleMiningPositions), (p: Position) => p !== candidatePosition);
            if (nextAdjacentPositions.length) {
                // single child with it's own child
                return {
                    numberOfChildren: 2,
                    childrenType: "double",
                    childrenDirections: [
                        MapUtils.getExactDirection(candidatePosition, adjacentPositions[0]).constant,
                        MapUtils.getExactDirection(adjacentPositions[0], nextAdjacentPositions[0]).constant
                    ]
                };
            } else {
                // single child with no children
                return {
                    numberOfChildren: 1,
                    childrenType: "single",
                    childrenDirections: [
                        MapUtils.getExactDirection(candidatePosition, adjacentPositions[0]).constant
                    ]
                };
            }
        } else {
            // no children
            return {
                numberOfChildren: 0,
                childrenType: "none",
                childrenDirections: []
            };
        }
    }

    static orderChildPositions(childPositions: Position[], spawn: StructureSpawn) {
        return _.sortByAll(
            childPositions,
            [
                (p: Position) => MapUtils.isPlains(spawn.room, p) ? 0 : 1,
                (p: Position) => MapUtils.getManhattanDistance(spawn.pos, p)
            ]);
    }

    static getBestPositions(positionEvaluations: PositionEvaluation[], spawn: StructureSpawn): PositionEvaluation[] {
        // TODO: return multiple positions if needed
        const bestPosition = this.sortPositions(positionEvaluations, spawn)[0];
        if (bestPosition) {
            return [bestPosition];
        }
        return [];
    }

    static sortPositions(positionEvaluations: PositionEvaluation[], spawn: StructureSpawn): PositionEvaluation[] {
        return _.sortByAll(
            positionEvaluations,
            [
                (e: PositionEvaluation) => -1 * e.numberOfChildren,
                (e: PositionEvaluation) => e.isPlains ? 0 : 1,
                (e: PositionEvaluation) => e.path.length,
                (e: PositionEvaluation) => MapUtils.getManhattanDistance(spawn.pos, e.position)
            ]
        );
    }

    get childMiners() {
        return _.flatten(_.map(this.miningPositionChildren, c => c.miners));
    }

    get allMiners() {
        if (this.mainMiner) {
            return [this.mainMiner, ...this.childMiners];
        } else {
            return this.childMiners;
        }
    }

    runCreeps() {
        this.movers && _.forEach(this.movers, mover => this.runMover(mover));
        this.runMainMiner();
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

    runMover(mover: Miner) {
        if (mover.fatigue === 0) {
            if (MapUtils.getChebyshevDistance(mover.pos, this.memory.miningPosition) > 1) {
                this.colony.movementOverseer.moveCreep(mover, this.memory.miningPosition);
            } else if (MapUtils.getChebyshevDistance(mover.pos, this.memory.miningPosition) === 1) {
                this.clearMainPosition();
                mover.move(MapUtils.getExactDirection(mover.pos, this.memory.miningPosition).constant);
                mover.memory.isMain = true;
                mover.memory.task = "mine";
            }
        }
    }

    runMainMiner() {
        if (this.mainMiner) {
            this.mainMiner.harvest(this.source);
            if (this.mainMiner.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                this.mainMiner.drop(RESOURCE_ENERGY);
            }
        }
    }

    runChildMiner(miner: Miner) {
        miner.harvest(this.source);
        if (this.mainMiner && miner.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            miner.transfer(this.mainMiner, RESOURCE_ENERGY);
        }
    }

    clearMainPosition() {
        if (this.mainMiner) {
            _.find(this.miningPositionChildren, "hasSpace")!.moveMinerIn(this.mainMiner);
        }
    }

    get droppedEnergy() {
        return this.miningPosition.lookFor(LOOK_ENERGY)[0];
    }

    getFirstMinerCreepOrder(): CreepOrder<MinerMemory> {
        return {
            spec: MinerSpec,
            options: {
                memory: {mineIndex: this.index, task: "move"},
                directions: [this.memory.pathToMiningPosition[0].direction]
            }
        };
    }

    getAllCreepOrders(): CreepOrder<MinerMemory>[] {
        const numberOfMinersToRequest = this.miningPositionChildren.length + 1 - this.allMiners.length;
        return _.fill(Array(numberOfMinersToRequest), this.getFirstMinerCreepOrder());
    }
}
