/** Binary min-heap of integer items ordered by a numeric priority. */
export class MinHeap {
  private readonly items: number[] = []
  private readonly priorities: number[] = []

  get size(): number {
    return this.items.length
  }

  push(item: number, priority: number): void {
    this.items.push(item)
    this.priorities.push(priority)
    let index = this.items.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if ((this.priorities[parent] ?? 0) <= priority) {
        break
      }
      this.swap(index, parent)
      index = parent
    }
  }

  /** Removes and returns the item with the lowest priority. The heap must not be empty. */
  pop(): number {
    const top = this.items[0] ?? -1
    const lastItem = this.items.pop() ?? -1
    const lastPriority = this.priorities.pop() ?? 0
    if (this.items.length === 0) {
      return top
    }
    this.items[0] = lastItem
    this.priorities[0] = lastPriority
    let index = 0
    for (;;) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index
      if (left < this.items.length && (this.priorities[left] ?? 0) < (this.priorities[smallest] ?? 0)) {
        smallest = left
      }
      if (right < this.items.length && (this.priorities[right] ?? 0) < (this.priorities[smallest] ?? 0)) {
        smallest = right
      }
      if (smallest === index) {
        return top
      }
      this.swap(index, smallest)
      index = smallest
    }
  }

  private swap(a: number, b: number): void {
    const item = this.items[a] ?? 0
    this.items[a] = this.items[b] ?? 0
    this.items[b] = item
    const priority = this.priorities[a] ?? 0
    this.priorities[a] = this.priorities[b] ?? 0
    this.priorities[b] = priority
  }
}
