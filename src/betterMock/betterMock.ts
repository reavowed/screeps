import {Mock} from "./Mock";
import {Stubbing} from "./Stubbing";
import {Recorder} from "./Recorder";
import {AnyMatcher, Matcher} from "./Matcher";

export function mock<T>() {
    return new Mock<T>().getProxy();
}

export function verify<T>(mock: T): T {
    return ((mock as any)["__mockitoMock"] as Mock<T>).getVerificationProxy();
}

export function when<T>(mockCallResult: T): Stubbing<T> {
    const lastInvocation = Recorder.lastInvocation;
    const matchers = Recorder.matchers;
    if (!lastInvocation) throw new Error("No mock invocation recorded to stub");
    Recorder.lastInvocation = null;
    Recorder.matchers = [];
    return new Stubbing<T>(lastInvocation, matchers);
}

export function any<T>(): T {
    Recorder.matchers.push(new AnyMatcher<T>());
    return undefined as any as T;
}
