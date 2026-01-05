import type { NextApiRequest, NextApiResponse } from 'next';
import { SparseMatrix } from '@/utils/SparseMatrix';

// Matriz dispersa persistente en memoria (backend)
const coverageMatrix = new SparseMatrix();

// Conversión GPS → celda de la matriz
function getCell(lat: number, lon: number) {
  const CELL_SIZE = 0.001; // ~100 metros
  return {
    row: Math.floor(lat / CELL_SIZE),
    col: Math.floor(lon / CELL_SIZE),
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('✔ API /coverage ejecutada');

  // REGISTRO DE COBERTURA (POST)
  if (req.method === 'POST') {
    const { lat, lon } = req.body;

    if (lat == null || lon == null) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const { row, col } = getCell(lat, lon);

    coverageMatrix.insert(row, col);

    console.log('[MATRIZ DISPERSA] Estado actual:', coverageMatrix.getAll());

    return res.status(200).json({
      message: 'Zona registrada',
      cell: { row, col },
    });
  }

  // CONSULTA DE COBERTURA (GET)
  if (req.method === 'GET') {
    console.log('[MATRIZ DISPERSA] Consulta realizada');
    return res.status(200).json(coverageMatrix.getAll());
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
