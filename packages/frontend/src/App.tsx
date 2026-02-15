import { AppShell } from './components/app-shell/AppShell';
import { FetchSchemaDataAdapter } from './adapters/fetch-schema-data-adapter';
import { FetchQueryAdapter } from './adapters/fetch-query-adapter';

const schemaPort = new FetchSchemaDataAdapter();
const queryPort = new FetchQueryAdapter();

function App() {
  return <AppShell schemaPort={schemaPort} queryPort={queryPort} />;
}

export default App;
