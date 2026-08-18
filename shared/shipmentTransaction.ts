export type ShipmentTransactionRunner<TTransaction> = {
  transaction<TResult>(work: (tx: TTransaction) => Promise<TResult>): Promise<TResult>;
};

export async function runShipmentTransaction<TTransaction, TResult>(
  database: ShipmentTransactionRunner<TTransaction>,
  work: (tx: TTransaction) => Promise<TResult>,
): Promise<TResult> {
  return database.transaction(work);
}
