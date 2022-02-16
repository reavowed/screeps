import {Matcher} from "./Matcher";
import {Invocation} from "./Invocation";

export class Recorder {
    public static lastInvocation: Invocation<any> | null = null;
    public static matchers: Matcher<any>[] = []
}
