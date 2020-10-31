import './globalsForTests';
import Searcher from './searcher';
import _ from 'lodash';

function createRoomWithWalls(walls) {
    const terrain = {};
    for (let y = 0; y < 50; ++y) {
        terrain[y] = {};
        for (let x = 0; x < 50; ++x) {
            terrain[y][x] = [{type: "terrain", terrain: "plain"}];
        }
    }
    _.forEach(walls, ([x, y]) => terrain[y][x][0].terrain = "wall");
    const room = {};
    room.getPositionAt = (x, y) => { return {x, y}; };
    room.lookAtArea = () => terrain;
    return room;
}

test('find a simple path', function () {
    const source = {x: 23, y: 14};
    const target = {x: 33, y: 19};
    const room = createRoomWithWalls();

    const path = new Searcher(room, source, target).findSinglePath();
    expect(path.length).toEqual(10);
    expect(path.map(p => p.direction)).toEqual([BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT]);
});

test('find a path around an object', function () {
    const source = {x: 23, y: 14};
    const target = {x: 31, y: 24};
    const walls = [
        [29, 21], [30, 21],
        [28, 22], [29, 22], [30, 22], [31, 22],
        [28, 23], [29, 23], [30, 23], [31, 23]
    ];
    const room = createRoomWithWalls(walls);

    const path = new Searcher(room, source, target).findSinglePath();
    expect(path.length).toEqual(11);
    expect(path.map(p => p.direction)).toEqual([BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT]);
});

test('prefer fewer changes in direction', function () {
    const source = {x: 20, y: 25};
    const target = {x: 20, y: 30};
    const walls = [
        [21, 26],
        [20, 27], [21, 27],
        [20, 28], [21, 28],
        [20, 29], [21, 29],
        [21, 30]
    ];
    const room = createRoomWithWalls(walls);

    const path = new Searcher(room, source, target).findSinglePath();

    expect(path.map(p => p.direction)).toEqual([BOTTOM_LEFT, BOTTOM, BOTTOM, BOTTOM, BOTTOM_RIGHT]);
});

test('avoid a square', function () {
    const source = {x: 20, y: 27};
    const target = {x: 21, y: 31};
    const walls = [
        [21, 28]
    ];
    const room = createRoomWithWalls(walls);

    const path = new Searcher(room, source, target).avoidingPositions([{x: 21, y: 29}]).findSinglePath();

    expect(path.map(p => p.direction)).toEqual([BOTTOM, BOTTOM, BOTTOM_RIGHT, BOTTOM]);
});

test('calculate path length', function () {
    const source = {x: 23, y: 14};
    const target = {x: 33, y: 19};
    const room = createRoomWithWalls();

    const pathLength = new Searcher(room, source, target).findPathLength();

    expect(pathLength).toEqual(10);
});

test('find multiple goals', function () {
    const source = {x: 24, y: 16};
    const target = {x: 29, y: 20};
    const room = createRoomWithWalls([[29,20]]);

    const paths = new Searcher(room, source, target).withTargetRange(1).findAllPaths();

    expect(paths.length).toEqual(2);
    expect(paths[0].map(p => p.direction)).toEqual([BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT]);
    expect(paths[1].map(p => p.direction)).toEqual([BOTTOM_RIGHT, BOTTOM_RIGHT, BOTTOM_RIGHT, RIGHT]);
});
