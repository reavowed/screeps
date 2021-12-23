import './globalsForTests';
import sinon from 'sinon';
import {EnergyMine} from './area.energyMine';
import {createRoomWithWalls} from './search.test.common';
import {randomId} from "./testUtils";

beforeEach(() => {
    global.Game = {};
    Game.getObjectById = sinon.stub();
});


function createSource(room = room, x, y) {
    const source = {
        id: randomId(),
        room,
        pos: {x, y}
    };
    Game.getObjectById
        .withArgs(source.id)
        .returns(source);
    return source;
}

function createSpawn(room, x, y) {
    return {
        pos: {x, y},
        room
    };
}

function createEnergyMine(room, source, spawn, memory = {}, creeps = []) {
    const colony = {
        room,
        nest: {
            spawn
        },
        movementOverseer: {
            moveCreep: sinon.spy()
        }
    };
    memory = EnergyMine.initialiseMemory(source, spawn);
    return new EnergyMine(colony, memory, 0, creeps);
}

function createEnergyMineWithTwoSingleChildren(creeps) {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(room, 30, 21);
    const spawn = createSpawn(room, 30, 15);
    const memory = {
        miningPosition: {x: 30, y: 20},
        miningPositionChildren: [RIGHT, LEFT],
        initialised: true
    };

    const energyMine = createEnergyMine(room, source, spawn, memory, creeps);

    return {room, source, spawn, energyMine};
}

function createEnergyMineWithADoubleChild(creeps) {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(room, 30, 21);
    const spawn = createSpawn(room, 24, 15);
    const memory = {
        miningPosition: {x: 29, y: 20},
        miningPositionChildren: [[RIGHT, RIGHT]],
        initialised: true
    };

    const energyMine = createEnergyMine(room, source, spawn, memory, creeps);

    return {room, source, spawn, energyMine};
}

function createMiner() {
    const miner = {
        pos: {x: 30, y: 20},
        memory: {},
        fatigue: 0,
        move: sinon.mock(),
        harvest: sinon.mock(),
        drop: sinon.mock(),
        transfer: sinon.mock(),
        store: {
            getUsedCapacity: sinon.mock()
        }
    };
    miner.store.getUsedCapacity.withArgs(RESOURCE_ENERGY).returns(0);
    miner.withStoredEnergy = (amount) => {
        miner.store.getUsedCapacity.withArgs(RESOURCE_ENERGY).returns(amount);
        return miner;
    };
    miner.withMemory = (memory) => {
        miner.memory = memory;
        return miner;
    };
    miner.atPosition = (position) => {
        miner.pos = position;
        return miner;
    };
    return miner;
}

test('pick a central mining space against a wall', () => {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(room, 30, 21);
    const spawn = createSpawn(room, 30, 15);

    const energyMine = createEnergyMine(room, source, spawn);

    expect(energyMine.memory.miningPosition).toEqual({x: 30, y: 20});
    expect(energyMine.memory.miningPositionChildrenType).toEqual("twoSingle")
    expect(energyMine.memory.miningPositionChildrenDirections).toEqual([RIGHT, LEFT]);
});

test('pick an offset central mining space against a wall', () => {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(room, 30, 21);
    const spawn = createSpawn(room, 24, 15);

    const energyMine = createEnergyMine(room, source, spawn);

    expect(energyMine.memory.miningPosition).toEqual({x: 29, y: 20});
    expect(energyMine.memory.miningPositionChildrenType).toEqual("double")
    expect(energyMine.memory.miningPositionChildrenDirections).toEqual([RIGHT, RIGHT]);
});

test('delegate a distant miner to the movement overseer and continue moving', () => {
    const creep = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 16});
    const {energyMine} = createEnergyMineWithTwoSingleChildren([creep]);
    energyMine.runCreeps();

    expect(energyMine.colony.movementOverseer.moveCreep).toHaveBeenCalledWith(creep, {x: 30, y: 20});
    expect(creep.memory.task).toBe("move");
});

test('run all miners in two single children', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true}).withStoredEnergy(10);
    const firstChildMiner = createMiner().withMemory({task: "mine", childIndex: 0}).withStoredEnergy(10);
    const secondChildMiner = createMiner().withMemory({task: "mine", childIndex: 1}).withStoredEnergy(0);

    const {energyMine, source} = createEnergyMineWithTwoSingleChildren([mainMiner, firstChildMiner, secondChildMiner]);

    energyMine.runCreeps();

    expect(mainMiner.harvest).toHaveBeenCalledWith(source);
    expect(firstChildMiner.harvest).toHaveBeenCalledWith(source);
    expect(secondChildMiner.harvest).toHaveBeenCalledWith(source);

    expect(firstChildMiner.transfer).toHaveBeenCalledWith(mainMiner, RESOURCE_ENERGY);
    expect(secondChildMiner.transfer).toHaveBeenCalledTimes(0);
    expect(mainMiner.drop).toHaveBeenCalledWith(RESOURCE_ENERGY);
});

test('move a close miner to the mining position and switch roles', () => {
    const creep = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});
    const {energyMine} = createEnergyMineWithTwoSingleChildren([creep]);
    energyMine.runCreeps();

    expect(creep.move).toHaveBeenCalledWith(BOTTOM);
    expect(energyMine.colony.movementOverseer.moveCreep).toHaveBeenCalledTimes(0);
    expect(creep.memory.task).toBe("mine");
    expect(creep.memory.isMain).toBe(true);
});

test('move an existing miner out of the way into a single child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});

    const {energyMine} = createEnergyMineWithTwoSingleChildren([mainMiner, mover]);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.isMain).toBe(true);
    expect(mainMiner.memory.isMain).toBe(undefined);
    expect(mainMiner.memory.childIndex).toBe(0);
});

test('move an existing miner out of the way into a second child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const childMiner = createMiner().withMemory({task: "mine", childIndex: 0});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});

    const {energyMine} = createEnergyMineWithTwoSingleChildren([mainMiner, childMiner, mover]);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM);
    expect(mainMiner.move).toHaveBeenCalledWith(LEFT);
    expect(childMiner.move).toHaveBeenCalledTimes(0);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.isMain).toBe(true);
    expect(mainMiner.memory.isMain).toBe(undefined);
    expect(mainMiner.memory.childIndex).toBe(1);
});

test('move an existing miner out of the way into a double child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 28, y: 19});

    const {energyMine} = createEnergyMineWithADoubleChild([mainMiner, mover]);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM_RIGHT);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.isMain).toBe(true);
    expect(mainMiner.memory.isMain).toBe(undefined);
    expect(mainMiner.memory.childIndex).toBe(0);
    expect(mainMiner.memory.isSecondary).toBe(undefined);
});

test('move an existing miner out of the way into an occupied double child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const childMiner = createMiner().withMemory({task: "mine", childIndex: 0, secondary: false});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 28, y: 19});

    const {energyMine} = createEnergyMineWithADoubleChild([mainMiner, childMiner, mover]);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM_RIGHT);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);
    expect(childMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.isMain).toBe(true);
    expect(mainMiner.memory.isMain).toBe(undefined);
    expect(mainMiner.memory.childIndex).toBe(0);
    expect(mainMiner.memory.isSecondary).toBe(undefined);
    expect(childMiner.memory.childIndex).toBe(0);
    expect(childMiner.memory.isSecondary).toBe(true);
});

test('recover a main miner from a single child', () => {
    const firstChildMiner = createMiner().withMemory({task: "mine", childIndex: 0});
    const secondChildMiner = createMiner().withMemory({task: "mine", childIndex: 1});

    const {energyMine} = createEnergyMineWithTwoSingleChildren([firstChildMiner, secondChildMiner]);
    energyMine.runCreeps();

    expect(firstChildMiner.move).toHaveBeenCalledWith(LEFT);
    expect(secondChildMiner.move).toHaveBeenCalledTimes(0);
});

test('recover a main miner from a second single child', () => {
    const childMiner = createMiner().withMemory({task: "mine", childIndex: 1});

    const {energyMine} = createEnergyMineWithTwoSingleChildren([childMiner]);
    energyMine.runCreeps();

    expect(childMiner.move).toHaveBeenCalledWith(RIGHT);
});

test('recover a main miner from a double child', () => {
    const firstChildMiner = createMiner().withMemory({task: "mine", childIndex: 0});
    const secondChildMiner = createMiner().withMemory({task: "mine", childIndex: 0, secondary: true});

    const {energyMine} = createEnergyMineWithADoubleChild([firstChildMiner, secondChildMiner]);
    energyMine.runCreeps();

    expect(firstChildMiner.move).toHaveBeenCalledWith(LEFT);
    expect(secondChildMiner.move).toHaveBeenCalledTimes(0);
});


test('rebalance a double child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const childMiner = createMiner().withMemory({task: "mine", childIndex: 0, isSecondary: true});

    const {energyMine} = createEnergyMineWithADoubleChild([mainMiner, childMiner]);
    energyMine.runCreeps();

    expect(childMiner.move).toHaveBeenCalledWith(LEFT);
    expect(mainMiner.move).toHaveBeenCalledTimes(0);
});
