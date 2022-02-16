import * as _ from "lodash";
import {Invocation} from "./Invocation";
import {EqualsMatcher, Matcher} from "./Matcher";

export class MethodInvocation<T> implements Invocation<T> {
    constructor(public args: any[], public mockDataForMethod: MockDataForMethod<T>) {}

    matchesArguments(args: any[]): boolean {
        if (args.length !== this.args.length) return false;
        for(let i = 0; i < args.length; i++) {
            if (args[i] !== this.args[i]) {
                return false;
            }
        }
        return true;
    }

    convertToStub(result: T, matchers: Matcher<any>[]) {
        this.convertToStubWithAnswer(() => result, matchers);
    }

    convertToStubWithAnswer(answer: (args: any[]) => T, matchers: Matcher<any>[]) {
        if (matchers.length > 0) {
            if (matchers.length !== this.args.length) {
                throw new Error(`Wrong number of matchers - expected ${this.args.length}, got ${matchers.length}`)
            }
        } else {
            matchers = this.args.map((arg: any) => new EqualsMatcher(arg));
        }
        this.mockDataForMethod.convertToStub(this, answer, matchers);
    }
}

export class MethodStub<T> {
    constructor(public readonly answer: (...args: any[]) => T, public readonly matchers: Matcher<any>[], public mockDataForMethod: MockDataForMethod<T>) {}
    matchesArguments(args: any[]): boolean {
        if (args.length !== this.matchers.length) return false;
        for(let i = 0; i < args.length; i++) {
            if (!this.matchers[i].test(args[i])) {
                return false;
            }
        }
        return true;
    }
}

export class MockDataForMethod<T> {
    private invocations: MethodInvocation<T>[] = []
    private stubs: MethodStub<T>[] = [];
    constructor(public readonly name: PropertyKey) {}

    recordInvocation(args: any[]): MethodInvocation<T> {
        let methodInvocation = new MethodInvocation<T>(args, this);
        this.invocations.push(methodInvocation);
        return methodInvocation;
    }
    convertToStub(invocation: MethodInvocation<T>, answer: (args: any[]) => T, matchers: Matcher<any>[]): void {
        this.invocations = _.filter(this.invocations, i => i !== invocation);
        this.stubs.push(new MethodStub<T>(answer, matchers, this));
    }

    verifyInvocation(args: any[]): void {
        const matchingInvocation = _.find(this.invocations, i => i.matchesArguments(args));
        if (!matchingInvocation) {
            throw new Error(`Method ${String(this.name)} was never invoked with the given arguments. It was invoked ${this.invocations.length} times.`);
        }
    }
    public getResult(args: any[]): T {
        const stub = _.findLast(this.stubs, stub => stub.matchesArguments(args));
        if (stub) {
            return stub.answer(...args);
        } else {
            return undefined as any as T;
        }
    }
}
