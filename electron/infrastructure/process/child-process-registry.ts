import type { ChildProcess } from "node:child_process";

export class ChildProcessRegistry extends Set<ChildProcess> {}
