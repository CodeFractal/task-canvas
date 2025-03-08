export class SimpleEvent<TEventArgs extends any[]> extends EventTarget implements IEvent<TEventArgs> {
    /** Subscribe to the event. */
    public subscribe(callback: (...args: TEventArgs) => void): IEventSubscription {
        // Define an event handler that extracts the detail from our custom event.
        const handler = (e: Event) => {
            if (e instanceof CustomEvent) {
                callback(...e.detail);
            }
        };
        // Listen to the custom event type (you can change 'custom' if needed).
        this.addEventListener('custom', handler as EventListener);
        // Return an unsubscribable
        return { unsubscribe: () => this.removeEventListener('custom', handler as EventListener) };
    }

    /** Invoke the event with data. */
    public get invoke(): (...args: TEventArgs) => void {
        return this.callSubscribers.bind(this) as any;
    }

    // Raise the event with data.
    private callSubscribers(...args: any[]): void {
        // Create a new CustomEvent carrying our data.
        const event = new CustomEvent('custom', { detail: args });
        // Dispatch the event to all subscribers.
        this.dispatchEvent(event);
    }
}

export interface IEvent<TEventArgs extends any[]> {
    subscribe(callback: (...args: TEventArgs) => void): IEventSubscription;    
}

export interface IEventSubscription {
    unsubscribe(): void;
}
