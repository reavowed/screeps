import * as _ from "lodash";
import {Invocation} from "./Invocation";
import {Matcher} from "./Matcher";

export class FieldInvocation<T> implements Invocation<T> {
    constructor(private mockDataForField: MockDataForField<T>) {}

    convertToStub(result: T, matchers: Matcher<any>[]) {
        if (matchers.length > 0) {
            throw new Error("No matchers expected for field");
        }
        this.mockDataForField.convertToStub(this, result);
    }
}
export class FieldStub<T> {
    constructor(public readonly result: T, private mockDataForField: MockDataForField<T>) {}
}

export class MockDataForField<T> {
    private invocations: FieldInvocation<T>[] = []
    private stubs: FieldStub<T>[] = [];
    constructor(public readonly name: PropertyKey) {}

    recordInvocation(): FieldInvocation<T> {
        let invocation = new FieldInvocation<T>(this);
        this.invocations.push(invocation);
        return invocation;
    }
    public getResult(): T {
        const stub = _.find(this.stubs);
        if (stub) {
            return stub.result;
        } else {
            return undefined as any as T;
        }
    }
    verifyInvocation(): void {
        const matchingInvocation = _.find(this.invocations);
        if (!matchingInvocation) {
            throw new Error(`Field ${String(this.name)} was never invoked.`);
        }
    }
    convertToStub(invocation: FieldInvocation<T>, result: T): void {
        this.invocations = _.filter(this.invocations, i => i !== invocation);
        this.stubs.push(new FieldStub<T>(result, this));
    }
}
