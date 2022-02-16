import {Invocation} from "./Invocation";
import {Matcher} from "./Matcher";
import {MethodInvocation} from "./MockDataForMethod";

export class Stubbing<T> {
    constructor(public readonly invocation: Invocation<T>, public readonly matchers: Matcher<any>[]) {}

    thenReturn(result: T): void {
        this.invocation.convertToStub(result, this.matchers);
    }
    thenAnswer(answer: (...args: any[]) => T): void {
        if (this.invocation instanceof MethodInvocation) {
            this.invocation.convertToStubWithAnswer(answer, this.matchers);
        } else {
            throw new Error("Cannot answer property invocation")
        }
    }
}
