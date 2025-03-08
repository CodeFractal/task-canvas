/** A simple event that can be subscribed to. (Browser-Only: backed by EventTarget and CustomEvent) */
export class SimpleEvent<TEventArgs extends any[]> implements IEvent<TEventArgs> {
    private readonly target = new EventTarget();

    /** Create a new instance of SimpleEvent.
     * @param eventName The name of the event. Default is 'SimpleEvent'.
     */
    constructor(private readonly eventName: string = 'SimpleEvent') { }

    /** Subscribe to the event.
     * @param callback The callback to invoke when the event is raised.
     * @returns An object that can be used to unsubscribe from the event.
    */
    public subscribe(callback: (...args: TEventArgs) => void): IEventSubscription {
        const handler = (e: Event) => {
            const ce = e as CustomEvent;
            callback(...ce.detail);
        };
        
        this.target.addEventListener(this.eventName, handler);

        return {
            unsubscribe: () => this.target.removeEventListener(this.eventName, handler)
        };
    }

    /** Invoke the event. */
    public invoke(...args: TEventArgs): void {
        const event = new CustomEvent(this.eventName, { detail: args });
        this.target.dispatchEvent(event);
    }
}

/** An event that can be subscribed to. */
export interface IEvent<TEventArgs extends any[]> {
    subscribe(callback: (...args: TEventArgs) => void): IEventSubscription;    
}

/** An object that can be used to unsubscribe from an event. */
export interface IEventSubscription {
    unsubscribe(): void;
}