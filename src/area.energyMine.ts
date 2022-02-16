import {Direction, MapUtils, Position} from "./utils.map";
import * as _ from "lodash";
import Colony from "./room.colony";
import {Miner, MinerMemory, MinerSpec} from "./creeps/miner";
import {isDefined} from "./utils";
import {CreepOrder} from "./area.nest";
import {Searcher} from "./searcher";

export interface EnergyMineMemory {
    sourceId: Id<Source>
    miningPosition: MainMiningPositionMemory
    approachingMiners: string[]
}
interface MiningPositionMemory {
    minerName?: string
    children: ChildMiningPositionMemory[]
}
interface MainMiningPositionMemory extends MiningPositionMemory {
    position: Position
    path: PathStep[]
}
interface ChildMiningPositionMemory extends MiningPositionMemory {
    directionFromParent: DirectionConstant
}

interface MiningPositionEvaluation {
    position: Position,
    path: PathStep[],
    children: ChildMiningPositionMemory[],
    isPlains: boolean
}

abstract class MiningPosition {
    readonly energyMine: EnergyMine;
    readonly memory: MiningPositionMemory;
    miner?: Creep;
    readonly children: ChildMiningPosition[]
    constructor(energyMine: EnergyMine, memory: MiningPositionMemory) {
        this.energyMine = energyMine;
        this.memory = memory;
        this.miner = energyMine.colony.getCreep(memory.minerName) as Miner;
        this.children = memory.children.map(c => new ChildMiningPosition(energyMine, c, this))
    }
    get miners(): Creep[] {
        const miners = _.flatten(this.children.map(c => c.miners));
        if (this.miner) {
            miners.unshift(this.miner);
        }
        return miners;
    }
    get freeSpaces(): number {
        const freeSpacesInChildren = _.sum(this.children.map(c => c.freeSpaces));
        if (this.miner) {
            return freeSpacesInChildren;
        } else {
            return freeSpacesInChildren + 1;
        }
    }
    runCreeps(): void {
        this.runMiner();
        this.children.forEach(c => c.runCreeps());
    }

    runMiner() {
        if (this.miner) {
            this.miner.harvest(this.energyMine.source);
        }
    }
    canAcceptMiner(): boolean {
        return !this.miner || _.any(this.children, c => c.canAcceptMiner());
    }
    abstract getIncomingMinerDirection(miner: Creep): Direction
    acceptMiner(miner: Creep) {
        if (this.miner) {
            const child = _.find(this.children, c => c.canAcceptMiner())!;
            child.acceptMiner(this.miner);
            this.miner = miner;
            this.memory.minerName = miner.name;
        }
        miner.move(this.getIncomingMinerDirection(miner).constant);
    }
    clearSpaceForMiner() {
        if (this.miner) {
            const child = _.find(this.children, c => c.canAcceptMiner())!;
            child.clearSpaceForMiner();
            this.miner.move(MapUtils.reverseDirectionConstant(child.directionFromParent.constant));
        }
    }
}

class MainMiningPosition extends MiningPosition {
    readonly position: RoomPosition;

    constructor(energyMine: EnergyMine, memory: MainMiningPositionMemory) {
        super(energyMine, memory);
        this.position = energyMine.colony.room.getPositionAt(memory.position.x, memory.position.y)!;
    }

    override runMiner() {
        super.runMiner();
        if (this.miner && this.miner.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            this.miner.drop(RESOURCE_ENERGY);
        }
    }

    override getIncomingMinerDirection(miner: Creep): Direction {
        return MapUtils.getExactDirection(miner.pos, this.position);
    }
}

class ChildMiningPosition extends MiningPosition {
    readonly parent: MiningPosition;
    readonly directionFromParent: Direction

    constructor(energyMine: EnergyMine, memory: ChildMiningPositionMemory, parent: MiningPosition) {
        super(energyMine, memory);
        this.parent = parent;
        this.directionFromParent = MapUtils.directionsByConstant[memory.directionFromParent];
    }

    override runMiner() {
        super.runMiner();
        if (this.miner && this.parent.miner && this.miner.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            this.miner.transfer(this.parent.miner, RESOURCE_ENERGY);
        }
    }

    getIncomingMinerDirection(miner: Creep): Direction {
        return this.directionFromParent;
    }
}

export class EnergyMine {
    readonly colony: Colony;
    readonly memory: EnergyMineMemory;
    readonly index: number;
    readonly source: Source;
    readonly incomingMiners: Creep[];
    readonly miningPosition: MainMiningPosition;

    constructor(colony: Colony, memory: EnergyMineMemory, index: number, creeps: Creep[]) {
        this.colony = colony;
        this.memory = memory;
        this.index = index;
        this.source = Game.getObjectById(this.memory.sourceId)!;
        this.incomingMiners = memory.approachingMiners.map(n => colony.getCreep(n)).filter(isDefined);
        this.miningPosition = new MainMiningPosition(this, this.memory.miningPosition);
    }

    static initialiseMemory(source: Source, spawn: StructureSpawn): EnergyMineMemory {
        const possibleMiningPositions = MapUtils.findAdjacentFreeSpaces(source.room, source.pos);
        const positionEvaluations = possibleMiningPositions
            .map((position: Position) => this.evaluateMiningPosition(position, possibleMiningPositions, spawn))
            .filter(isDefined);
        const {position, path, children} = this.getBestPositions(positionEvaluations, spawn)[0];
        return {
            sourceId: source.id,
            miningPosition: {
                position,
                path,
                children
            },
            approachingMiners: []
        }
    }

    static evaluateMiningPosition(candidatePosition: Position, allPossibleMiningPositions: Position[], spawn: StructureSpawn): MiningPositionEvaluation | undefined {
        const adjacentMiningPositions = MapUtils.filterAdjacentSpaces(candidatePosition, allPossibleMiningPositions);
        let path = new Searcher(spawn.room, spawn.pos, candidatePosition).avoidingPositions(adjacentMiningPositions).findSinglePath();
        if (path !== ERR_NO_PATH) {
            const children = this.getBestChildren(candidatePosition, allPossibleMiningPositions, spawn)
            return {
                position: candidatePosition,
                children,
                path,
                isPlains: MapUtils.isPlains(spawn.room, candidatePosition)
            }
        }
    }

    static getBestChildren(candidatePosition: Position, allPossibleMiningPositions: Position[], spawn: StructureSpawn): ChildMiningPositionMemory[] {
        const adjacentPositions = MapUtils.filterAdjacentSpaces(candidatePosition, allPossibleMiningPositions);
        if (adjacentPositions.length >= 2) {
            return _.chain(this.orderChildPositions(adjacentPositions, spawn))
                .take(2)
                .map((p: Position) => MapUtils.getExactDirection(candidatePosition, p).constant)
                .map((directionFromParent: DirectionConstant) => { return {
                    directionFromParent,
                    children: []
                }})
                .value();
        } else if (adjacentPositions.length === 1) {
            const nextAdjacentPositions = _.filter(MapUtils.filterAdjacentSpaces(adjacentPositions[0], allPossibleMiningPositions), (p: Position) => p !== candidatePosition);
            if (nextAdjacentPositions.length) {
                return [{
                    directionFromParent: MapUtils.getExactDirection(candidatePosition, adjacentPositions[0]).constant,
                    children: [{
                        directionFromParent: MapUtils.getExactDirection(adjacentPositions[0], nextAdjacentPositions[0]).constant,
                        children: []
                    }]
                }];
            } else {
                return [{
                    directionFromParent: MapUtils.getExactDirection(candidatePosition, adjacentPositions[0]).constant,
                    children: []
                }];
            }
        } else {
            return [];
        }
    }

    static orderChildPositions(childPositions: Position[], spawn: StructureSpawn): Position[] {
        return _.sortByAll(
            childPositions,
            [
                (p: Position) => MapUtils.isPlains(spawn.room, p) ? 0 : 1,
                (p: Position) => MapUtils.getManhattanDistance(spawn.pos, p)
            ]);
    }

    static getBestPositions(positionEvaluations: MiningPositionEvaluation[], spawn: StructureSpawn): MiningPositionEvaluation[] {
        // TODO: return multiple positions if needed
        const bestPosition = this.sortPositions(positionEvaluations, spawn)[0];
        if (bestPosition) {
            return [bestPosition];
        }
        return [];
    }

    static sortPositions(positionEvaluations: MiningPositionEvaluation[], spawn: StructureSpawn): MiningPositionEvaluation[] {
        return _.sortByAll(
            positionEvaluations,
            [
                (e: MiningPositionEvaluation) => -1 * this.countChildren(e.children),
                (e: MiningPositionEvaluation) => e.isPlains ? 0 : 1,
                (e: MiningPositionEvaluation) => e.path.length,
                (e: MiningPositionEvaluation) => MapUtils.getManhattanDistance(spawn.pos, e.position)
            ]
        );
    }

    static countChildren(children: ChildMiningPositionMemory[]): number {
        return children.length + _.sum(children, c => this.countChildren(c.children));
    }

    runCreeps() {
        this.incomingMiners && _.forEach(this.incomingMiners, mover => this.moveIncomingMiner(mover));
        this.miningPosition.runCreeps();
    }

    private moveIncomingMiner(miner: Creep) {
        if (miner.fatigue === 0) {
            if (MapUtils.getChebyshevDistance(miner.pos, this.memory.miningPosition.position) > 1) {
                this.colony.movementOverseer.moveCreepByPath(miner, this.memory.miningPosition.path);
            } else if (MapUtils.getChebyshevDistance(miner.pos, this.memory.miningPosition.position) === 1) {
                this.miningPosition.acceptMiner(miner);
            }
        }
    }

    get droppedEnergy(): Resource<RESOURCE_ENERGY> {
        return this.miningPosition.position.lookFor(LOOK_ENERGY)[0];
    }

    getFirstMinerCreepOrder(): CreepOrder<MinerMemory> {
        return {
            spec: MinerSpec,
            options: {
                memory: {mineIndex: this.index, task: "move"},
                directions: [this.memory.miningPosition.path[0].direction]
            }
        };
    }

    getAllCreepOrders(): CreepOrder<MinerMemory>[] {
        const numberOfMinersToRequest = this.miningPosition.freeSpaces;
        if (numberOfMinersToRequest > 0)
            return _.fill(Array(numberOfMinersToRequest), this.getFirstMinerCreepOrder());
        else
            return [];
    }
}
