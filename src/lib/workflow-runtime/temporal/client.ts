import { Client, Connection } from '@temporalio/client'
import { resolveTemporalRuntimeConfig } from './config'

export async function createTemporalClient() {
  const config = resolveTemporalRuntimeConfig()
  const connection = await Connection.connect({
    address: config.address,
  })
  const client = new Client({
    connection,
    namespace: config.namespace,
  })
  return { client, connection, config }
}

