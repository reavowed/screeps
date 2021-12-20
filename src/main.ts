import {Mastermind} from "./mastermind";

export const loop = () => {
    try {
        const masterMind = Mastermind.load();
        masterMind.run();
    } catch (e: any) {
        if (e.stack) console.log(e.stack);
    }
};
