import heapq
import random
from dataclasses import dataclass, field
from typing import List, Dict


@dataclass(order=True)
class Event:
    time: float
    type: str = field(compare=False)  # states include: "order_arrival" or "order_completion"
    data: dict = field(compare=False)


class Attendant:
    def __init__(self, name: str):
        self.name = name
        self.active_orders: List[float] = []  # Start times of active orders
        self.status: str = "active"  # statuss i.e 'active', 'inactive', 'overloaded'
        self.next_available: float = 0  # Next time slot for new orders

    def update_state(self, current_time: float):
        """Update order completion status and availability"""
        # Remove completed orders i.e, orders older than 5 secs
        self.active_orders = [t for t in self.active_orders if t + 5 > current_time]

        # Calculate next availability
        if len(self.active_orders) == 0:
            self.next_available = current_time
        elif len(self.active_orders) == 1:
            self.next_available = max(current_time, self.active_orders[0] + 3)
        else:
            self.next_available = max(
                self.active_orders[0] + 5,  # First order completes
                self.active_orders[1] + 3  # Cooldown from second order
            )

    def can_accept(self, current_time: float) -> bool:
        if self.status != "active":
            return False
        return current_time >= self.next_available and len(self.active_orders) < 2

    def start_order(self, start_time: float):
        self.active_orders.append(start_time)
        self.active_orders.sort()


class Orchestrator:
    def __init__(self, attendants: List[Attendant]):
        self.attendants = {a.name: a for a in attendants}
        self.event_queue = []
        self.current_time = 0.0
        self.processed = 0
        self.rejected = 0

    def add_order(self, arrival_time: float):
        heapq.heappush(self.event_queue, Event(arrival_time, 'order_arrival', {}))

    def update_attendant_status(self, name: str, status: str):
        """Handle attendant shutdown/revival events"""
        self.attendants[name].status = status
        if status == 'active':
            self.attendants[name].update_state(self.current_time)

    def process_events(self):
        while self.event_queue:
            event = heapq.heappop(self.event_queue)
            self.current_time = event.time

            if event.type == 'order_arrival':
                self.handle_order_arrival()
            elif event.type == 'order_completion':
                self.handle_order_completion(event.data['attendant'])

    def handle_order_arrival(self):
        candidates = []
        for name, attendant in self.attendants.items():
            attendant.update_state(self.current_time)

            if attendant.can_accept(self.current_time):
                # calculate priority, i.e, we prefer attendants with fewer active orders
                priority = (len(attendant.active_orders), random.random())
                candidates.append((priority, name))

        if candidates:
            # Select attendant with best availability
            _, best = min(candidates)
            self.attendants[best].start_order(self.current_time)
            self.processed += 1

            # Schedule order completion
            heapq.heappush(
                self.event_queue,
                Event(self.current_time + 5, 'order_completion', {'attendant': best})
            )

            print(f"[{self.current_time:.2f}] Order accepted by {best}")
        else:
            self.rejected += 1
            print(f"[{self.current_time:.2f}] Order rejected")

    def handle_order_completion(self, attendant_name: str):
        print(f"[{self.current_time:.2f}] Order completed by {attendant_name}")
        self.attendants[attendant_name].update_state(self.current_time)


if __name__ == "__main__":
    # we Initialize system with 2 attendants
    attendants = [Attendant("Alice"), Attendant("Bob")]
    orchestrator = Orchestrator(attendants)

    # Simulate random order arrivals
    for _ in range(20):
        orchestrator.add_order(random.uniform(0, 30))

    # Simulate attendant B going offline at time 10
    orchestrator.add_order(10.0)  # Special event for shutdown
    heapq.heappush(orchestrator.event_queue,
                   Event(10.0, 'order_completion', {'attendant': 'Bob'}))

    orchestrator.process_events()

    print(f"\nTotal processed: {orchestrator.processed}")
    print(f"Total rejected: {orchestrator.rejected}")
