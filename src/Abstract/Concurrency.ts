/**
 * A simple semaphore that allows only one holder at a time.
 */
export class SimpleSemaphore {
    private locked = false;
    private waiting: Array<() => void> = [];

    /**
     * Acquires the semaphore lock.
     *
     * If the lock is free, the promise resolves immediately.
     * Otherwise, it waits until the lock is released.
     *
     * @returns {Promise<void>} A promise that resolves when the lock is acquired.
     */
    acquire(): Promise<void> {
        return new Promise(resolve => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            } else {
                this.waiting.push(resolve);
            }
        });
    }

    /**
     * Releases the semaphore lock.
     *
     * If there are any waiting callbacks, it hands off the lock to the next one.
     */
    release(): void {
        if (this.waiting.length > 0) {
            const nextResolve = this.waiting.shift();
            if (nextResolve) {
                nextResolve();
            }
        } else {
            this.locked = false;
        }
    }

    /**
     * Executes a callback safely when the lock becomes available.
     *
     * This method acquires the lock, executes the provided callback, and ensures
     * the lock is released after the callback is executed, even if an error occurs.
     *
     * @param callback - The callback function to execute while holding the lock.
     * @returns A promise that resolves with the callback's return value.
     */
    async withLock<T>(callback: () => Promise<T> | T): Promise<T> {
        await this.acquire();
        try {
            return await callback();
        } finally {
            this.release();
        }
    }
}

/**
 * A class that encapsulates a resource of type T, allowing safe and exclusive access
 * through a callback function.
 */
export class SafeResource<T> {
    private resource: T;
    private semaphore: SimpleSemaphore;

    /**
     * Creates a new SafeResource.
     *
     * @param {T} resource - The resource to encapsulate.
     */
    constructor(resource: T) {
        this.resource = resource;
        this.semaphore = new SimpleSemaphore();
    }

    /**
     * Safely executes a callback with exclusive access to the encapsulated resource.
     *
     * The callback receives the resource as its argument. The semaphore ensures that
     * only one callback can access the resource at a time.
     *
     * @param callback - The callback function that uses the resource.
     * @returns A promise that resolves with the callback's return value.
     */
    async withResource<R>(callback: (resource: T) => Promise<R> | R): Promise<R> {
        return this.semaphore.withLock(() => callback(this.resource));
    }

    /**
     * Safely sets (overwrites) the stored resource with a new value.
     *
     * This method acquires the semaphore lock to ensure exclusive access while updating
     * the resource.
     *
     * @param {T} newResource - The new resource to set.
     * @returns {Promise<void>} A promise that resolves once the resource has been updated.
     */
    async setResource(newResource: T): Promise<void> {
        await this.semaphore.withLock(() => {
            this.resource = newResource;
        });
    }
}

/**
 * Waits, asynchronously for the specified number of milliseconds.
 * @param ms The number of milliseconds to wait.
 * @returns A promise that resolves after the specified time has elapsed.
 */
export function WaitAsync(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * A debouncer that delays execution of an action until no new requests come in for a specified delay,
 * and ensures a cooldown period after the action completes before it can be executed again.
 */
export class DebounceScheduler {
    private delay: number;
    private cooldown: number;
    private action: () => Promise<void>;
    private timer: number | null = null;
    private lastCompletionTime: number;
    private executing: boolean = false;
    private pending: boolean = false;

    /**
     * Creates a new DebounceScheduler.
     *
     * @param action - The asynchronous action to debounce.
     * @param delay - The delay in milliseconds to wait after the last request before executing the action.
     * @param cooldown - The minimum cooldown time in milliseconds after the action completes before it can run again.
     */
    constructor(action: () => Promise<void>, delay: number, cooldown: number) {
        this.action = action;
        this.delay = delay;
        this.cooldown = cooldown;
        this.lastCompletionTime = Date.now() - cooldown;
    }

    /**
     * Requests execution of the action. Subsequent calls reset the debounce timer.
     */
    public request(): void {
        this.pending = true;
        if (this.timer !== null) {
            clearTimeout(this.timer);
        }
        const schedule = () => {
            this.timer = null;
            this.runAction();
        };

        const now = Date.now();
        const timeSinceCompletion = now - this.lastCompletionTime;
        let waitTime = this.delay;
        if (timeSinceCompletion < this.cooldown) {
            waitTime = Math.max(waitTime, this.cooldown - timeSinceCompletion);
        }
        this.timer = window.setTimeout(schedule, waitTime);
    }

    private async runAction(): Promise<void> {
        if (this.executing) return;
        this.executing = true;
        // Clear pending here so that we only capture new requests made during execution.
        this.pending = false;
        try {
            await this.action();
        } finally {
            this.lastCompletionTime = Date.now();
            this.executing = false;
            if (this.pending) {
                this.request();
            }
        }
    }
}
