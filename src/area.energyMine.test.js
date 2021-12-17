import './globalsForTests';
import sinon from 'sinon';
import EnergyMine from './area.energyMine';
import {createRoomWithWalls} from './search.test.common';

beforeEach(() => {
    global.Game = {};
    Game.getObjectById = sinon.stub();
});

function randomId() {
    const buffer = new ArrayBuffer(8);
    const floatArray = new Float64Array(buffer);
    floatArray[0] = Math.random();
    return [...new Uint8Array (buffer).slice(0, 4)]
        .map (b => b.toString(16).padStart (2, "0"))
        .join ("");
}

function createSource(x, y) {
    const source = {
        id: randomId(),
        pos: {x, y}
    };
    Game.getObjectById
        .withArgs(source.id)
        .returns(source);
    return source;
}

function createSpawn(x, y) {
    return {
        pos: {x, y}
    };
}

function createEnergyMine(room, source, spawn, memory) {
    const colony = {
        room,
        nest: {
            spawn
        },
        movementOverseer: {
            moveCreep: sinon.spy()
        }
    };
    memory = {...(memory || {}), sourceId: source.id};
    return new EnergyMine(colony, memory, 0);
}

function createEnergyMineWithTwoSingleChildren() {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(30, 21);
    const spawn = createSpawn(30, 15);
    const memory = {
        miningPosition: {x: 30, y: 20},
        miningPositionChildren: [RIGHT, LEFT],
        initialised: true
    };

    const energyMine = createEnergyMine(room, source, spawn, memory);
    energyMine.load();

    return {room, source, spawn, energyMine};
}

function createEnergyMineWithADoubleChild() {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(30, 21);
    const spawn = createSpawn(24, 15);
    const memory = {
        miningPosition: {x: 29, y: 20},
        miningPositionChildren: [[RIGHT, RIGHT]],
        initialised: true
    };

    const energyMine = createEnergyMine(room, source, spawn, memory);
    energyMine.load();

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
    const source = createSource(30, 21);
    const spawn = createSpawn(30, 15);

    const energyMine = createEnergyMine(room, source, spawn);
    energyMine.load();

    expect(energyMine.memory.initialised).toBe(true);
    expect(energyMine.memory.miningPosition).toEqual({x: 30, y: 20});
    expect(energyMine.memory.miningPositionChildren).toEqual([RIGHT, LEFT]);
});

test('pick an offset central mining space against a wall', () => {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(30, 21);
    const spawn = createSpawn(24, 15);

    const energyMine = createEnergyMine(room, source, spawn);
    energyMine.load();

    expect(energyMine.memory.initialised).toBe(true);
    expect(energyMine.memory.miningPosition).toEqual({x: 29, y: 20});
    expect(energyMine.memory.miningPositionChildren).toEqual([[RIGHT, RIGHT]]);
});

test('delegate a distant miner to the movement overseer and continue moving', () => {
    const {energyMine} = createEnergyMineWithTwoSingleChildren();

    const creep = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 16});
    energyMine.addCreep(creep);
    energyMine.runCreeps();

    expect(energyMine.colony.movementOverseer.moveCreep).toHaveBeenCalledWith(creep, {x: 30, y: 20});
    expect(creep.memory.task).toBe("move");
});

test('run all miners in two single children', () => {
    const {energyMine, source} = createEnergyMineWithTwoSingleChildren();
    const mainMiner = createMiner().withMemory({task: "mine", main: true}).withStoredEnergy(10);
    const firstChildMiner = createMiner().withMemory({task: "mine", child: 0}).withStoredEnergy(10);
    const secondChildMiner = createMiner().withMemory({task: "mine", child: 1}).withStoredEnergy(0);

    energyMine.addCreep(mainMiner);
    energyMine.addCreep(firstChildMiner);
    energyMine.addCreep(secondChildMiner);
    energyMine.runCreeps();

    expect(mainMiner.harvest).toHaveBeenCalledWith(source);
    expect(firstChildMiner.harvest).toHaveBeenCalledWith(source);
    expect(secondChildMiner.harvest).toHaveBeenCalledWith(source);

    expect(firstChildMiner.transfer).toHaveBeenCalledWith(mainMiner, RESOURCE_ENERGY);
    expect(secondChildMiner.transfer).toHaveBeenCalledTimes(0);
    expect(mainMiner.drop).toHaveBeenCalledWith(RESOURCE_ENERGY);
});

test('move a close miner to the mining position and switch roles', () => {
    const {energyMine} = createEnergyMineWithTwoSingleChildren();

    const creep = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});

    energyMine.addCreep(creep);
    energyMine.runCreeps();

    expect(creep.move).toHaveBeenCalledWith(BOTTOM);
    expect(energyMine.colony.movementOverseer.moveCreep).toHaveBeenCalledTimes(0);
    expect(creep.memory.task).toBe("mine");
    expect(creep.memory.main).toBe(true);
});

test('move an existing miner out of the way into a single child', () => {
    const {energyMine} = createEnergyMineWithTwoSingleChildren();

    const mainMiner = createMiner().withMemory({task: "mine", main: true});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});

    energyMine.addCreep(mainMiner);
    energyMine.addCreep(mover);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.main).toBe(true);
    expect(mainMiner.memory.main).toBe(undefined);
    expect(mainMiner.memory.child).toBe(0);
});

test('move an existing miner out of the way into a second child', () => {
    const {energyMine} = createEnergyMineWithTwoSingleChildren();

    const mainMiner = createMiner().withMemory({task: "mine", main: true});
    const childMiner = createMiner().withMemory({task: "mine", child: 0});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});

    energyMine.addCreep(mainMiner);
    energyMine.addCreep(childMiner);
    energyMine.addCreep(mover);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM);
    expect(mainMiner.move).toHaveBeenCalledWith(LEFT);
    expect(childMiner.move).toHaveBeenCalledTimes(0);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.main).toBe(true);
    expect(mainMiner.memory.main).toBe(undefined);
    expect(mainMiner.memory.child).toBe(1);
});

test('move an existing miner out of the way into a double child', () => {
    const {energyMine} = createEnergyMineWithADoubleChild();

    const mainMiner = createMiner().withMemory({task: "mine", main: true});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 28, y: 19});

    energyMine.addCreep(mainMiner);
    energyMine.addCreep(mover);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM_RIGHT);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.main).toBe(true);
    expect(mainMiner.memory.main).toBe(undefined);
    expect(mainMiner.memory.child).toBe(0);
    expect(mainMiner.memory.secondary).toBe(false);
});

test('move an existing miner out of the way into an occupied double child', () => {
    const {energyMine} = createEnergyMineWithADoubleChild();

    const mainMiner = createMiner().withMemory({task: "mine", main: true});
    const childMiner = createMiner().withMemory({task: "mine", child: 0, secondary: false});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 28, y: 19});

    energyMine.addCreep(mainMiner);
    energyMine.addCreep(childMiner);
    energyMine.addCreep(mover);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM_RIGHT);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);
    expect(childMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.main).toBe(true);
    expect(mainMiner.memory.main).toBe(undefined);
    expect(mainMiner.memory.child).toBe(0);
    expect(mainMiner.memory.secondary).toBe(false);
    expect(childMiner.memory.child).toBe(0);
    expect(childMiner.memory.secondary).toBe(true);
});

test('recover a main miner from a single child', () => {
    const {energyMine} = createEnergyMineWithTwoSingleChildren();

    const firstChildMiner = createMiner().withMemory({task: "mine", child: 0});
    const secondChildMiner = createMiner().withMemory({task: "mine", child: 1});

    energyMine.addCreep(firstChildMiner);
    energyMine.addCreep(secondChildMiner);
    energyMine.runCreeps();

    expect(firstChildMiner.move).toHaveBeenCalledWith(LEFT);
    expect(secondChildMiner.move).toHaveBeenCalledTimes(0);
});

test('recover a main miner from a second single child', () => {
    const {energyMine} = createEnergyMineWithTwoSingleChildren();

    const childMiner = createMiner().withMemory({task: "mine", child: 1});

    energyMine.addCreep(childMiner);
    energyMine.runCreeps();

    expect(childMiner.move).toHaveBeenCalledWith(RIGHT);
});

test('recover a main miner from a double child', () => {
    const {energyMine} = createEnergyMineWithADoubleChild();

    const firstChildMiner = createMiner().withMemory({task: "mine", child: 0});
    const secondChildMiner = createMiner().withMemory({task: "mine", child: 0, secondary: true});

    energyMine.addCreep(firstChildMiner);
    energyMine.addCreep(secondChildMiner);
    energyMine.runCreeps();

    expect(firstChildMiner.move).toHaveBeenCalledWith(LEFT);
    expect(secondChildMiner.move).toHaveBeenCalledTimes(0);
});


test('rebalance a double child', () => {
    const {energyMine} = createEnergyMineWithADoubleChild();

    const mainMiner = createMiner().withMemory({task: "mine", main: true});
    const childMiner = createMiner().withMemory({task: "mine", child: 0, secondary: true});

    energyMine.addCreep(mainMiner);
    energyMine.addCreep(childMiner);
    energyMine.runCreeps();

    expect(childMiner.move).toHaveBeenCalledWith(LEFT);
    expect(mainMiner.move).toHaveBeenCalledTimes(0);
});
