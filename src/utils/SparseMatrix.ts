// Nodo de la matriz dispersa (Lista Enlazada)
class SparseNode {
  row: number;
  col: number;
  value: number;
  next: SparseNode | null = null;

  constructor(row: number, col: number) {
    this.row = row;
    this.col = col;
    this.value = 1;
  }
}

// Matriz Dispersa usando Lista Enlazada
export class SparseMatrix {
  private head: SparseNode | null = null;

  insert(row: number, col: number): void {
    if (!this.head) {
      this.head = new SparseNode(row, col);
      return;
    }

    let current = this.head;

    while (current) {
      if (current.row === row && current.col === col) {
        current.value++;
        return;
      }
      if (!current.next) break;
      current = current.next;
    }

    current.next = new SparseNode(row, col);
  }

  getAll(): { row: number; col: number; value: number }[] {
    const result = [];
    let current = this.head;

    while (current) {
      result.push({
        row: current.row,
        col: current.col,
        value: current.value,
      });
      current = current.next;
    }

    return result;
  }
}
