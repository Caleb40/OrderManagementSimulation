type EventData = Record<string, any>;

interface Event {
    time: number;
    type: string;
    data: EventData;
}

interface Attendant {
    updateState: (currentTime: number) => void;
    canAccept: (currentTime: number) => boolean;
    startOrder: (startTime: number) => void;
    getName: () => string;
    getStatus: () => string;
}

interface Orchestrator {
    addOrder: (arrivalTime: number) => void;
    updateAttendantStatus: (name: string, status: string) => void;
    processEvents: () => void;
    getStats: () => { processed: number; rejected: number };
}

const createEvent = (time: number, type: string, data: EventData = {}): Event => ({
    time,
    type,
    data
});

const createAttendant = (name: string): Attendant => {
    let activeOrders: number[] = [];
    let status = "active";
    let nextAvailable = 0;

    return {
        updateState: (currentTime: number) => {
            activeOrders = activeOrders.filter(t => t + 5 > currentTime);

            if (activeOrders.length === 0) {
                nextAvailable = currentTime;
            } else if (activeOrders.length === 1) {
                nextAvailable = Math.max(currentTime, activeOrders[0] + 3);
            } else {
                nextAvailable = Math.max(
                    activeOrders[0] + 5,
                    activeOrders[1] + 3
                );
            }
        },

        canAccept: (currentTime: number) => {
            return status === "active" &&
                   currentTime >= nextAvailable &&
                   activeOrders.length < 2;
        },

        startOrder: (startTime: number) => {
            activeOrders.push(startTime);
            activeOrders.sort((a, b) => a - b);
        },

        getName: () => name,
        getStatus: () => status
    };
};

const createOrchestrator = (attendants: Attendant[]): Orchestrator => {
    const attendantsMap = new Map<string, Attendant>();
    let eventQueue: Event[] = [];
    let currentTime = 0;
    let processed = 0;
    let rejected = 0;

    // Initialize attendants map
    attendants.forEach(attendant => {
        attendantsMap.set(attendant.getName(), attendant);
    });

    const handleOrderCompletion = (attendantName: string) => {
        const attendant = attendantsMap.get(attendantName);
        if (attendant) {
            console.log(`[${currentTime.toFixed(2)}] Order completed by ${attendantName}`);
            attendant.updateState(currentTime);
        }
    };

    const handleOrderArrival = () => {
        const candidates: Array<[number, number, string]> = [];

        attendantsMap.forEach(attendant => {
            attendant.updateState(currentTime);

            if (attendant.canAccept(currentTime)) {
                const load = attendant.getStatus() === "active" ?
                    attendantsMap.get(attendant.getName())!.startOrder.length : Infinity;
                const priority = [load, Math.random()];
                candidates.push([priority[0], priority[1], attendant.getName()]);
            }
        });

        if (candidates.length > 0) {
            // Sort by load then random factor
            candidates.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const best = candidates[0][2];
            const attendant = attendantsMap.get(best)!;

            attendant.startOrder(currentTime);
            processed++;

            // Schedule completion
            eventQueue.push(createEvent(
                currentTime + 5,
                'order_completion',
                { attendant: best }
            ));
            eventQueue.sort((a, b) => a.time - b.time);

            console.log(`[${currentTime.toFixed(2)}] Order accepted by ${best}`);
        } else {
            rejected++;
            console.log(`[${currentTime.toFixed(2)}] Order rejected`);
        }
    };

    return {
        addOrder: (arrivalTime: number) => {
            eventQueue.push(createEvent(arrivalTime, 'order_arrival'));
            eventQueue.sort((a, b) => a.time - b.time);
        },

        updateAttendantStatus: (name: string, status: string) => {
            const attendant = attendantsMap.get(name);
            if (attendant) {
                // Using type assertion to update internal state
                (attendant as any).status = status;
                if (status === 'active') {
                    attendant.updateState(currentTime);
                }
            }
        },

        processEvents: () => {
            while (eventQueue.length > 0) {
                const event = eventQueue.shift()!;
                currentTime = event.time;

                if (event.type === 'order_arrival') {
                    handleOrderArrival();
                } else if (event.type === 'order_completion') {
                    handleOrderCompletion(event.data.attendant);
                }
            }
        },

        getStats: () => ({ processed, rejected })
    };
};

// Example usage
const main = () => {
    // Create attendants
    const attendants = [
        createAttendant("Alice"),
        createAttendant("Bob")
    ];

    // Create orchestrator
    const orchestrator = createOrchestrator(attendants);

    // Generate random orders
    for (let i = 0; i < 20; i++) {
        orchestrator.addOrder(Math.random() * 30);
    }

    // Simulate attendant going offline at time 10
    orchestrator.updateAttendantStatus("Bob", "inactive");

    // Process events
    orchestrator.processEvents();

    // Get stats
    const stats = orchestrator.getStats();
    console.log(`\nResults:`);
    console.log(`Processed orders: ${stats.processed}`);
    console.log(`Rejected orders: ${stats.rejected}`);
};

main();