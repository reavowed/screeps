import {Matcher} from "./Matcher";

export interface Invocation<T> {
    convertToStub(result: T, matchers: Matcher<any>[]): void;
}
