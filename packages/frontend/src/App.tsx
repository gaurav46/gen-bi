import { AppShell } from './components/app-shell/AppShell';
import { FetchSchemaDataAdapter } from './adapters/fetch-schema-data-adapter';
import { FetchQueryAdapter } from './adapters/fetch-query-adapter';
import { FetchDashboardAdapter } from './adapters/fetch-dashboard-adapter';

const schemaPort = new FetchSchemaDataAdapter();
const queryPort = new FetchQueryAdapter();
const dashboardPort = new FetchDashboardAdapter();

function App() {
  return <AppShell schemaPort={schemaPort} queryPort={queryPort} dashboardPort={dashboardPort} />;
}

export default App;
