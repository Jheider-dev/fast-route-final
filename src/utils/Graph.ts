interface Edge {
  node: string; 
  weight: number; 
}

export class RouteGraph {
  adjacencyList: Map<string, Edge[]>;

  constructor() {
    this.adjacencyList = new Map();
  }

  addStop(stopId: string) {
    if (!this.adjacencyList.has(stopId)) {
      this.adjacencyList.set(stopId, []);
    }
  }

  addConnection(startId: string, endId: string, weight: number) {
    if (!this.adjacencyList.has(startId)) this.addStop(startId);
    if (!this.adjacencyList.has(endId)) this.addStop(endId);

    this.adjacencyList.get(startId)?.push({ node: endId, weight });
  }

  findShortestPath(startNode: string, endNode: string) {
    const distances: { [key: string]: number } = {};
    const previous: { [key: string]: string | null } = {};
    const queue: string[] = [];

    for (let vertex of Array.from(this.adjacencyList.keys())) {
      if (vertex === startNode) {
        distances[vertex] = 0;
        queue.unshift(vertex); 
      } else {
        distances[vertex] = Infinity;
        queue.push(vertex);
      }
      previous[vertex] = null;
    }

    while (queue.length > 0) {
      queue.sort((a, b) => distances[a] - distances[b]);
      const current = queue.shift(); 

      if (!current) break;
      if (current === endNode) break; 

      const neighbors = this.adjacencyList.get(current) || [];

      for (let neighbor of neighbors) {
        const alt = distances[current] + neighbor.weight;
        if (alt < distances[neighbor.node]) {
          distances[neighbor.node] = alt;
          previous[neighbor.node] = current;
        }
      }
    }

    const path = [];
    let u: string | null = endNode;
    while (u !== null) {
        path.unshift(u);
        u = previous[u];
        if(u === endNode) break; 
    }
    
    return {
        distance: distances[endNode],
        path: path
    };
  }
}